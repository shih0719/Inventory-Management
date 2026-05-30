const db = require("../config/database");

async function logAction(userId, action, resourceType, resourceId, warehouseId) {
  try {
    if (!userId || !action || !resourceType || !resourceId) {
      console.warn(
        "⚠️ Incomplete audit log data:",
        { userId, action, resourceType, resourceId }
      );
      return;
    }

    await db.run(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, warehouse_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, resourceType, resourceId, warehouseId || null]
    );
  } catch (err) {
    console.error("❌ Failed to log audit action:", err.message);
  }
}

async function getAuditLogs(filters = {}) {
  const { resourceType, resourceId, userId, warehouseId, limit = 50, offset = 0 } = filters;

  let sql = `
    SELECT
      a.id,
      a.user_id,
      u.username,
      a.action,
      a.resource_type,
      a.resource_id,
      a.warehouse_id,
      a.timestamp
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;

  const params = [];

  if (warehouseId) {
    sql += " AND a.warehouse_id = ?";
    params.push(warehouseId);
  }

  if (resourceType) {
    sql += " AND a.resource_type = ?";
    params.push(resourceType);
  }

  if (resourceId) {
    sql += " AND a.resource_id = ?";
    params.push(resourceId);
  }

  if (userId) {
    sql += " AND a.user_id = ?";
    params.push(userId);
  }

  sql += " ORDER BY a.timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const logs = await db.all(sql, params);

  let countSql = "SELECT COUNT(*) as total FROM audit_logs a WHERE 1=1";
  const countParams = [];

  if (warehouseId) {
    countSql += " AND a.warehouse_id = ?";
    countParams.push(warehouseId);
  }

  if (resourceType) {
    countSql += " AND a.resource_type = ?";
    countParams.push(resourceType);
  }

  if (resourceId) {
    countSql += " AND a.resource_id = ?";
    countParams.push(resourceId);
  }

  if (userId) {
    countSql += " AND a.user_id = ?";
    countParams.push(userId);
  }

  const countResult = await db.get(countSql, countParams);
  const total = countResult?.total || 0;

  return {
    data: logs || [],
    pagination: { total, offset, limit },
  };
}

module.exports = { logAction, getAuditLogs };
