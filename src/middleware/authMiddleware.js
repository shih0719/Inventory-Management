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

module.exports = {
  verifyAuth,
};
