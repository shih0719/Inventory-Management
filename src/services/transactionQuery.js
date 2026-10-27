/**
 * Transaction queries — read side of the Stock Ledger.
 *
 * One SELECT (product, tag, batch, location joined in) shared by the history
 * list, the CSV export, single lookups and the shipment/batch detail views.
 * The warehouse is a required argument: a transaction belongs to its product's
 * warehouse, and nothing here can be queried across warehouses.
 * Every function takes `conn` — `db`, or the `tx` from db.transaction().
 */

const BASE_SQL = `
  SELECT t.*,
         p.name AS product_name,
         p.sku,
         p.type AS product_type,
         tg.display_name AS tag_name,
         tg.color AS tag_color,
         b.batch_number,
         loc.name AS location_tag
  FROM transactions t
  JOIN products p ON t.product_id = p.id
  JOIN tags tg ON t.tag_id = tg.id
  LEFT JOIN batches b ON t.batch_id = b.id
  LEFT JOIN locations loc ON t.location_id = loc.id`;

// Allowed sort columns mapped to safe SQL identifiers (avoids SQL injection).
const SORT_COLUMNS = {
  created_at: "t.created_at",
  quantity_change: "t.quantity_change",
  sku: "p.sku",
  product_name: "p.name",
  tag_name: "tg.display_name",
  quantity_type: "t.quantity_type",
  created_by_user: "t.created_by_user",
};

function orderBy({ sort, order } = {}) {
  const col = SORT_COLUMNS[sort];
  if (!col) return " ORDER BY t.created_at DESC";
  const dir = order === "asc" ? "ASC" : "DESC";
  // Same-second rows follow insertion order in the same direction
  return ` ORDER BY ${col} ${dir}, t.id ${dir}`;
}

/**
 * WHERE clause for the warehouse plus optional filters. `filters` takes the
 * history page's query params, plus `ids` (array) for shipment detail.
 */
function buildWhere(warehouseId, filters = {}) {
  if (warehouseId == null) throw new Error("transactionQuery: warehouseId is required");
  const {
    from, to, quantity_type, direction, product_id, batch_id, created_by_user,
    sku, tag_id, min_quantity, max_quantity, ids,
  } = filters;

  let where = " WHERE p.warehouse_id = ?";
  const params = [warehouseId];
  const add = (cond, ...values) => { where += ` AND ${cond}`; params.push(...values); };

  if (sku) add("p.sku LIKE ?", `%${sku}%`);
  if (tag_id) add("t.tag_id = ?", parseInt(tag_id));
  if (min_quantity !== undefined) add("t.quantity_change >= ?", parseInt(min_quantity));
  if (max_quantity !== undefined) add("t.quantity_change <= ?", parseInt(max_quantity));
  if (from) add("date(t.created_at) >= date(?)", from);
  if (to) add("date(t.created_at) <= date(?)", to);
  if (quantity_type) add("t.quantity_type = ?", quantity_type);
  if (direction === "in") add("t.quantity_change > 0");
  else if (direction === "out") add("t.quantity_change < 0");
  if (product_id) add("t.product_id = ?", parseInt(product_id));
  if (batch_id) add("t.batch_id = ?", parseInt(batch_id));
  if (created_by_user) add("t.created_by_user = ?", created_by_user);
  if (ids) {
    if (ids.length === 0) add("0");
    else add(`t.id IN (${ids.map(() => "?").join(",")})`, ...ids);
  }
  return { where, params };
}

/** Attach `product_units` ({ id, serial_number, status }) to each row that moved serials. */
async function attachUnits(conn, rows) {
  for (const tx of rows) {
    if (!tx.product_unit_ids) {
      tx.product_units = null;
      continue;
    }
    try {
      const unitIds = JSON.parse(tx.product_unit_ids);
      if (Array.isArray(unitIds) && unitIds.length > 0) {
        tx.product_units = await conn.all(
          `SELECT id, serial_number, status FROM product_units WHERE id IN (${unitIds.map(() => "?").join(",")})`,
          unitIds,
        );
      }
    } catch (e) {
      console.error("Error parsing product_unit_ids:", e);
      tx.product_units = [];
    }
  }
  return rows;
}

/**
 * Transactions of the warehouse matching `filters`, with serials attached unless
 * `withUnits` is false. `sort` / `order` follow the history page; `limit` pages the result.
 */
async function list(conn, warehouseId, filters = {}, { sort, order, limit, offset = 0, withUnits = true } = {}) {
  const { where, params } = buildWhere(warehouseId, filters);
  let sql = BASE_SQL + where + orderBy({ sort, order });
  const rowParams = [...params];
  if (limit !== undefined) { sql += " LIMIT ? OFFSET ?"; rowParams.push(limit, offset); }
  const rows = await conn.all(sql, rowParams);
  return withUnits ? attachUnits(conn, rows) : rows;
}

async function count(conn, warehouseId, filters = {}) {
  const { where, params } = buildWhere(warehouseId, filters);
  const row = await conn.get(`SELECT COUNT(*) AS total FROM (${BASE_SQL + where}) AS filtered`, params);
  return row?.total || 0;
}

/** One transaction of the warehouse with serials attached, or undefined. */
async function getById(conn, warehouseId, id) {
  const { where, params } = buildWhere(warehouseId);
  const row = await conn.get(`${BASE_SQL}${where} AND t.id = ?`, [...params, id]);
  return row && (await attachUnits(conn, [row]))[0];
}

module.exports = { list, count, getById };
