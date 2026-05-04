const http = require("http");
const https = require("https");
const db = require("../config/database");

// Supported events for this system
const SUPPORTED_EVENTS = ["inventory.changed", "batch.created", "inventory.low"];

/**
 * Fire a webhook event (fire-and-forget, non-blocking)
 * @param {string} event - Event name
 * @param {object} data  - Event payload data
 */
function fire(event, data) {
  if (!SUPPORTED_EVENTS.includes(event)) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Non-blocking: run async in background
  _dispatchAll(event, payload).catch((err) => {
    console.error("[Webhook] Dispatch error:", err.message);
  });
}

/**
 * Query active subscriptions for the event and dispatch to each.
 */
async function _dispatchAll(event, payload) {
  let subscriptions;
  try {
    subscriptions = await db.all(
      "SELECT * FROM webhook_subscriptions WHERE is_active = 1"
    );
  } catch (err) {
    console.error("[Webhook] Failed to query subscriptions:", err.message);
    return;
  }

  for (const sub of subscriptions) {
    let events;
    try {
      events = JSON.parse(sub.events);
    } catch {
      events = [];
    }

    if (!events.includes(event)) continue;

    // Dispatch with retry (non-blocking per subscription)
    _dispatchWithRetry(sub, event, payload).catch((err) => {
      console.error(`[Webhook] Sub #${sub.id} fatal error:`, err.message);
    });
  }
}

/**
 * Dispatch to a single subscription with up to 3 retries (exponential backoff).
 */
async function _dispatchWithRetry(sub, event, payload) {
  const MAX_RETRIES = 3;
  const payloadStr = JSON.stringify(payload);
  let lastError = null;
  let lastStatusCode = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastStatusCode = await _post(sub.url, payloadStr);

      if (lastStatusCode >= 200 && lastStatusCode < 300) {
        // Success — write log
        await _writeLog(sub.id, event, payloadStr, lastStatusCode, attempt, true, null);
        console.log(`[Webhook] Sub #${sub.id} "${event}" delivered (attempt ${attempt}, HTTP ${lastStatusCode})`);
        return;
      }

      lastError = `HTTP ${lastStatusCode}`;
    } catch (err) {
      lastError = err.message;
      console.warn(`[Webhook] Sub #${sub.id} attempt ${attempt} failed: ${lastError}`);
    }

    // Backoff before retry: 1s, 3s, 9s
    if (attempt < MAX_RETRIES) {
      await _sleep(1000 * Math.pow(3, attempt - 1));
    }
  }

  // All retries exhausted — write failure log
  await _writeLog(sub.id, event, payloadStr, lastStatusCode, MAX_RETRIES, false, lastError);
  console.error(`[Webhook] Sub #${sub.id} "${event}" failed after ${MAX_RETRIES} attempts: ${lastError}`);
}

/**
 * HTTP/HTTPS POST helper, returns status code.
 */
function _post(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "InventoryManagement-Webhook/1.0",
      },
      timeout: 10000, // 10 second timeout
    };

    const req = lib.request(options, (res) => {
      res.resume(); // Drain response body
      resolve(res.statusCode);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out (10s)"));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Write a delivery result to webhook_logs.
 */
async function _writeLog(subscriptionId, event, payload, statusCode, attempts, success, errorMessage) {
  try {
    await db.run(
      `INSERT INTO webhook_logs
        (subscription_id, event, payload, status_code, attempts, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, event, payload, statusCode, attempts, success ? 1 : 0, errorMessage]
    );
  } catch (err) {
    console.error("[Webhook] Failed to write log:", err.message);
  }
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fire };
