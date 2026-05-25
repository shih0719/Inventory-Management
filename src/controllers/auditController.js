const auditService = require("../services/auditService");
const { formatTimestamps } = require("../utils/formatTimestamps");

/**
 * GET /api/audit-logs
 * Get audit logs with optional filtering
 */
async function getAuditLogs(req, res) {
  try {
    const { resource_type, resource_id, user_id, limit, offset } = req.query;

    const filters = {
      resourceType: resource_type,
      resourceId: resource_id ? parseInt(resource_id) : undefined,
      userId: user_id ? parseInt(user_id) : undefined,
      limit: limit ? Math.min(parseInt(limit), 200) : 50,
      offset: offset ? Math.max(parseInt(offset), 0) : 0,
    };

    // Remove undefined filters
    Object.keys(filters).forEach(
      (key) => filters[key] === undefined && delete filters[key]
    );

    const result = await auditService.getAuditLogs(filters);

    return res.status(200).json({
      success: true,
      data: formatTimestamps(result.data),
      pagination: result.pagination,
    });
  } catch (err) {
    console.error("❌ Get audit logs error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}

module.exports = {
  getAuditLogs,
};
