const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyAuth } = require("../middleware/authMiddleware");

router.get("/provider", (req, res) => {
  res.json({ provider: process.env.AUTH_PROVIDER || "local" });
});

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", verifyAuth, authController.getCurrentUser);
router.post("/change-password", verifyAuth, authController.changePassword);

module.exports = router;
