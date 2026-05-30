const authService = require("../services/authService");

/**
 * Verify JWT token from Authorization header
 * Attaches user info to req.user if valid
 */
function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing or invalid token",
      });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or expired token",
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Insufficient permissions",
      });
    }
    next();
  };
}

function requireWarehouse(req, res, next) {
  const warehouseId = req.headers["x-warehouse-id"];
  if (!warehouseId) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: X-Warehouse-Id header required",
    });
  }
  const id = parseInt(warehouseId, 10);
  if (isNaN(id)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Invalid warehouse ID",
    });
  }
  const allowedWarehouses = req.user?.warehouses || [];
  if (!allowedWarehouses.includes(id)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: No access to this warehouse",
    });
  }
  req.warehouseId = id;
  next();
}

module.exports = {
  verifyAuth,
  requireRole,
  requireWarehouse,
};
