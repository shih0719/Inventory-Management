const db = require("../config/database");
const quantityStateService = require("./quantityStateService");
const auditService = require("./auditService");
const { generateShipmentNumber } = require("./shipmentService");

class OutboundError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = "OutboundError";
    this.errors = errors;
  }
}

function normalizeSerial(sn) {
  return String(sn || "").trim().toUpperCase();
}

const typeLabel = (quantityType) => (quantityType === "accountable" ? "有帳" : "無帳");

/**
 * Validate and execute one outbound (Strict Mode: all-or-nothing).
 *
 * Side effects, inside one DB transaction: inserts a batch and its transactions,
 * decrements product quantities, marks AP units sold, and — when the tag is
 * OUTBOUND — inserts a shipment bound to every created transaction.
 *
 * @param {Object} input
 * @param {number} input.tagId
 * @param {string} [input.description]
 * @param {Array<{product_id:number, quantity:number, quantity_type:string, remarks?:string}>} [input.items]
 *        Non-AP lines; quantity is a positive number of units going out.
 * @param {string[]} [input.serials] AP serial numbers.
 * @param {{customer?:string, project_case?:string, shipment_date?:string}} [input.shipment]
 * @param {{userId:number, username:string, warehouseId:number}} actor
 * @throws {OutboundError} when any validation fails (nothing is written).
 */
async function createOutbound(input, actor) {
  const { tagId, description = "", items = [], serials = [], shipment = {} } = input;
  const customer = (shipment.customer || "").trim() || null;
  const projectCase = (shipment.project_case || "").trim() || null;

  if (items.length === 0 && serials.length === 0) {
    throw new OutboundError("至少需要一筆商品或序號");
  }

  const tag = await db.get("SELECT id, name FROM tags WHERE id = ?", [tagId]);
  if (!tag) throw new OutboundError(`tag_id ${tagId} 不存在`);

  const errors = [];
  // Running balance per product+type, so two lines of the same product are checked together.
  const running = new Map();
  const balanceKey = (productId, quantityType) => `${productId}:${quantityType}`;
  const takeFrom = (product, quantityType, count) => {
    const key = balanceKey(product.id, quantityType);
    const current = running.has(key)
      ? running.get(key)
      : quantityType === "accountable" ? product.accountable_quantity : product.non_accountable_quantity;
    const validation = quantityStateService.validate(current, -count, { quantityType });
    if (!validation.ok) return { error: validation.reason };
    running.set(key, validation.newQuantity);
    return { before: current, after: validation.newQuantity };
  };

  // ── Phase 1a: regular lines ────────────────────────────────────────────────
  const plannedTx = [];
  for (let i = 0; i < items.length; i++) {
    const { product_id, quantity, quantity_type, remarks } = items[i];
    const label = `第 ${i + 1} 行`;
    const count = parseInt(quantity, 10);

    if (!product_id || !Number.isInteger(count) || count <= 0) {
      errors.push(`${label}：需要商品與大於 0 的數量`);
      continue;
    }
    if (!["accountable", "non_accountable"].includes(quantity_type)) {
      errors.push(`${label}：quantity_type 必須是 accountable 或 non_accountable`);
      continue;
    }
    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
      [product_id, actor.warehouseId]
    );
    if (!product) {
      errors.push(`${label}：此倉庫找不到商品 ${product_id}`);
      continue;
    }
    if (product.track_serial) {
      errors.push(`${label}（${product.sku}）：AP 商品請掃描序號出貨`);
      continue;
    }
    const taken = takeFrom(product, quantity_type, count);
    if (taken.error) {
      errors.push(`${label}（${product.sku}）：${taken.error}`);
      continue;
    }
    plannedTx.push({
      product_id: product.id,
      quantity_type,
      quantity_change: -count,
      before: taken.before,
      after: taken.after,
      source: "batch",
      remarks: `[${typeLabel(quantity_type)}] ${remarks || description}`,
      unitIds: null,
    });
  }

  const createShipment = tag.name === 'OUTBOUND';
  const shipmentDate = shipment.shipment_date || new Date().toISOString().split('T')[0];
  if (createShipment) {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(shipmentDate) && !Number.isNaN(new Date(shipmentDate).getTime());
    if (!validDate) errors.push('shipment_date 格式錯誤（需為 YYYY-MM-DD）');
  }

  // ── Phase 1b: AP serials ───────────────────────────────────────────────────
  if (serials.length > 0 && !projectCase) {
    errors.push("出貨含 AP 序號時，案子（project_case）為必填");
  }
  const seen = new Set();
  const unitsByProduct = new Map();
  for (const raw of serials) {
    const sn = normalizeSerial(raw);
    if (!sn) {
      errors.push({ serial_number: "", reason: "序號不可為空" });
      continue;
    }
    if (seen.has(sn)) {
      errors.push({ serial_number: sn, reason: "批次內序號重複" });
      continue;
    }
    seen.add(sn);
    const unit = await db.get(
      `SELECT pu.id, pu.status, pu.product_id
       FROM product_units pu JOIN products p ON pu.product_id = p.id
       WHERE pu.serial_number = ? AND p.warehouse_id = ? AND p.is_deleted = 0`,
      [sn, actor.warehouseId]
    );
    if (!unit) {
      errors.push({ serial_number: sn, reason: "此倉庫找不到序號" });
    } else if (unit.status !== "in_stock") {
      errors.push({ serial_number: sn, reason: "已出庫" });
    } else {
      if (!unitsByProduct.has(unit.product_id)) unitsByProduct.set(unit.product_id, []);
      unitsByProduct.get(unit.product_id).push(unit.id);
    }
  }
  for (const [productId, unitIds] of unitsByProduct) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [productId]);
    const taken = takeFrom(product, "accountable", unitIds.length);
    if (taken.error) {
      errors.push(`${product.sku}：${taken.error}（序號品數量與帳面不一致）`);
      continue;
    }
    plannedTx.push({
      product_id: productId,
      quantity_type: "accountable",
      quantity_change: -unitIds.length,
      before: taken.before,
      after: taken.after,
      source: "ap-sell",
      remarks: `[有帳] ${description}`,
      unitIds,
    });
  }

  if (errors.length > 0) {
    throw new OutboundError(`驗證失敗，共 ${errors.length} 筆錯誤，整批取消`, errors);
  }

  // ── Phase 2: write everything atomically ───────────────────────────────────
  const soldAt = new Date().toISOString();

  await db.run("BEGIN TRANSACTION");
  try {
    const batchNumber = `BATCH-${Date.now()}`;
    const batch = await db.run(
      "INSERT INTO batches (batch_number, description, created_by_user) VALUES (?, ?, ?)",
      [batchNumber, description, actor.username]
    );
    auditService.logAction(actor.userId, "CREATE", "batch", batch.id, actor.warehouseId);

    const transactionIds = [];
    for (const tx of plannedTx) {
      if (tx.unitIds) {
        for (const unitId of tx.unitIds) {
          const updated = await db.run(
            "UPDATE product_units SET status = 'sold', project_case = ?, sold_to = ?, sold_at = ? WHERE id = ? AND status = 'in_stock'",
            [projectCase, customer, soldAt, unitId]
          );
          if (updated.changes !== 1) {
            throw new OutboundError(`序號單位 ${unitId} 已被其他操作出庫`);
          }
        }
      }
      const result = await db.run(
        `INSERT INTO transactions (product_id, tag_id, batch_id, quantity_change, quantity_type, quantity_before, quantity_after, source, remarks, product_unit_ids, created_by_user)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.product_id, tag.id, batch.id, tx.quantity_change, tx.quantity_type,
          tx.before, tx.after, tx.source, tx.remarks,
          tx.unitIds ? JSON.stringify(tx.unitIds) : null, actor.username,
        ]
      );
      transactionIds.push(result.id);
      auditService.logAction(actor.userId, "CREATE", "transaction", result.id);

      const field = tx.quantity_type === "accountable" ? "accountable_quantity" : "non_accountable_quantity";
      const stock = await db.run(
        `UPDATE products SET ${field} = ? WHERE id = ? AND ${field} = ?`,
        [tx.after, tx.product_id, tx.before]
      );
      if (stock.changes !== 1) {
        throw new OutboundError(`商品 ${tx.product_id} 庫存已變動，請重新送出`);
      }
    }

    let shipmentId = null;
    let shipmentNumber = null;
    if (createShipment) {
      shipmentNumber = await generateShipmentNumber(shipmentDate);
      const created = await db.run(
        `INSERT INTO shipments (shipment_number, customer, project_case, shipment_date, created_by_user)
         VALUES (?, ?, ?, ?, ?)`,
        [shipmentNumber, customer, projectCase, shipmentDate, actor.username]
      );
      shipmentId = created.id;
      for (const txId of transactionIds) {
        await db.run(
          "INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)",
          [shipmentId, txId]
        );
      }
      auditService.logAction(actor.userId, "CREATE", "shipment", shipmentId, actor.warehouseId);
    }

    await db.run("COMMIT");

    return {
      batch_id: batch.id,
      batch_number: batchNumber,
      transaction_ids: transactionIds,
      shipment_id: shipmentId,
      shipment_number: shipmentNumber,
    };
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

module.exports = { createOutbound, OutboundError };
