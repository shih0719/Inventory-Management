const authService = require("../services/authService");
const db = require("../config/database");

/**
 * POST /api/auth/login
 * Login with username and password
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "username and password are required",
      });
    }

    const result = await authService.login(username, password);

    return res.status(200).json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);

    if (err.message === "Invalid username or password") {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * POST /api/auth/logout
 * Logout (stateless - just return success)
 */
async function logout(req, res) {
  try {
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("❌ Logout error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * GET /api/auth/me
 * Get current user info from JWT token
 */
async function getCurrentUser(req, res) {
  try {
    const row = await db.get(
      "SELECT provider, role FROM users WHERE id = ?",
      [req.user.id]
    );
    const whRows = await db.all(
      "SELECT warehouse_id FROM user_warehouses WHERE user_id = ?",
      [req.user.id]
    );
    const assigned = whRows.map((r) => r.warehouse_id);
    const defaultWh = await db.get("SELECT id FROM warehouses WHERE name LIKE 'default' COLLATE NOCASE LIMIT 1");
    const warehouses = defaultWh && !assigned.includes(defaultWh.id)
      ? [defaultWh.id, ...assigned]
      : assigned;
    return res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        username: req.user.username,
        role: row ? row.role : req.user.role,
        provider: row ? row.provider : null,
        warehouses,
      },
    });
  } catch (err) {
    console.error("❌ Get current user error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to get current user",
    });
  }
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: "current_password and new_password are required",
      });
    }

    await authService.changePassword(req.user.id, current_password, new_password);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("❌ Change password error:", err.message);

    if (
      err.message === "Current password is incorrect" ||
      err.message === "User not found" ||
      err.message.startsWith("New password")
    ) {
      return res.status(400).json({ success: false, error: err.message });
    }

    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  login,
  logout,
  getCurrentUser,
  changePassword,
};
