const authService = require("../services/authService");

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

module.exports = {
  login,
  logout,
};
