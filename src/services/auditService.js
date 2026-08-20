const db = require("../config/database");

async function logAction(userId, action, resourceType, resourceId, warehouseId, options = {}) {
  try {
    const { eventCategory = "transaction", metadata = null, ipAddress = null } = options;

    if (!action || !resourceType) {
      console.warn("⚠️ Incomplete audit log data:", { userId, action, resourceType, resourceId });
      return;
    }

    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    await db.run(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, warehouse_id, event_category, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, action, resourceType, resourceId || null, warehouseId || null, eventCategory, metadataStr, ipAddress || null]
    );
  } catch (err) {
    console.error("❌ Failed to log audit action:", err.message);
  }
}

async function getAuditLogs(filters = {}) {
  const { resourceType, resourceId, userId, warehouseId, eventCategory, action, limit = 50, offset = 0 } = filters;

  let sql = `
    SELECT
      a.id,
      a.user_id,
      u.username,
      a.action,
      a.resource_type,
      a.resource_id,
      a.warehouse_id,
      a.event_category,
      a.metadata,
      a.ip_address,
      a.timestamp
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;

  const params = [];

  if (warehouseId) {
    // system events have no warehouse_id; include them unless filtering by transaction category
    if (eventCategory === "system") {
      // no warehouse filter — system events are global
    } else if (eventCategory === "transaction") {
      sql += " AND a.warehouse_id = ?";
      params.push(warehouseId);
    } else {
      sql += " AND (a.warehouse_id = ? OR a.event_category = 'system')";
      params.push(warehouseId);
    }
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

  if (action) {
    sql += " AND a.action = ?";
    params.push(action);
  }

  if (eventCategory) {
    sql += " AND a.event_category = ?";
    params.push(eventCategory);
  }

  sql += " ORDER BY a.timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const logs = await db.all(sql, params);

  let countSql = "SELECT COUNT(*) as total FROM audit_logs a WHERE 1=1";
  const countParams = [];

  if (warehouseId) {
    if (eventCategory === "system") {
      // no warehouse filter
    } else if (eventCategory === "transaction") {
      countSql += " AND a.warehouse_id = ?";
      countParams.push(warehouseId);
    } else {
      countSql += " AND (a.warehouse_id = ? OR a.event_category = 'system')";
      countParams.push(warehouseId);
    }
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

  if (action) {
    countSql += " AND a.action = ?";
    countParams.push(action);
  }

  if (eventCategory) {
    countSql += " AND a.event_category = ?";
    countParams.push(eventCategory);
  }

  const countResult = await db.get(countSql, countParams);
  const total = countResult?.total || 0;

  return {
    data: logs || [],
    pagination: { total, offset, limit },
  };
}

module.exports = { logAction, getAuditLogs };
