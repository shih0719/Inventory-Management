/**
 * Stock notifier — announces each shipment created by an outbound to the configured targets:
 * - STOCK_WEBHOOK_URL: the `stock.changed` event as JSON
 * - LINE_CHANNEL_ACCESS_TOKEN + LINE_TO: the event's text as a LINE push message
 *
 * The ledger `record`s every `apply` call of a DB transaction into one event; the outbound
 * attaches its shipment with `annotate`. After commit (db.afterCommit) only events with a
 * shipment are sent — other quantity changes send nothing. Unset targets are skipped. A failed send is logged and dropped:
 * no retry, and the request it came from is unaffected.
 */
const db = require("../config/database");
const logger = require("../config/logger");

const TIMEOUT_MS = 5000;
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_TEXT_MAX = 5000;
const TYPE_LABELS = { accountable: "有帳", non_accountable: "無帳" };

/** Message text, so chat targets (Slack/Teams/LINE) can show the event as is. */
function summarize({ actor, movements, shipment }) {
  const lines = movements.map(
    (m) => `・${m.name} ${TYPE_LABELS[m.quantityType]} ${m.before}→${m.after}（${m.delta > 0 ? "+" : ""}${m.delta}）`,
  );
  // An outbound ships from one warehouse, so every movement has the same one.
  return [
    `【出貨單】${shipment.shipmentNumber}`,
    `倉庫：${movements[0].warehouse || "-"}`,
    `客戶：${shipment.customer || "-"}　案件：${shipment.projectCase || "-"}`,
    `操作人：${actor}`,
    ...lines,
  ].join("\n");
}

async function post(target, url, body, headers = {}) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) logger.warn(`Stock ${target} responded ${res.status}`);
  } catch (error) {
    logger.warn(`Stock ${target} failed: ${error.message}`);
  }
}

async function send(event) {
  const { STOCK_WEBHOOK_URL, LINE_CHANNEL_ACCESS_TOKEN, LINE_TO } = process.env;
  const text = summarize(event);
  const sends = [];

  if (STOCK_WEBHOOK_URL) {
    sends.push(post("webhook", STOCK_WEBHOOK_URL,
      { event: "stock.changed", occurredAt: new Date().toISOString(), text, ...event }));
  }
  if (LINE_CHANNEL_ACCESS_TOKEN && LINE_TO) {
    const lineText = text.length > LINE_TEXT_MAX ? `${text.slice(0, LINE_TEXT_MAX - 1)}…` : text;
    sends.push(post("LINE push", LINE_PUSH_URL,
      { to: LINE_TO, messages: [{ type: "text", text: lineText }] },
      { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }));
  }
  await Promise.all(sends);
}

/** The open transaction's event; scheduled to send on its commit (if it has a shipment) when first created. */
function pending() {
  return db.transactionLocal("stockNotifier", () => {
    const event = { source: null, tag: null, actor: null, batchId: null, shipment: null, movements: [] };
    db.afterCommit(() => (event.shipment ? send(event) : undefined));
    return event;
  });
}

/**
 * Add one `apply` call's movements to the open transaction's event.
 * The first call sets source, tag, actor and batch; each movement keeps its own source.
 *
 * @param {{source:string, tag:string, actor:string, batchId:number|null, movements:Array<Object>}} change
 */
function record({ source, tag, actor, batchId, movements }) {
  const event = pending();
  event.source ??= source;
  event.tag ??= tag;
  event.actor ??= actor;
  event.batchId ??= batchId;
  event.movements.push(...movements.map((m) => ({ ...m, source })));
}

/** Attach the shipment created in the open transaction; only then is the event sent. */
function annotate({ shipment }) {
  pending().shipment = shipment;
}

module.exports = { record, annotate };
