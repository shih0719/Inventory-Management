const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyAuth } = require("../middleware/authMiddleware");

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/change-password", verifyAuth, authController.changePassword);

module.exports = router;
