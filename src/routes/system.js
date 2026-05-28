const express = require("express");
const router = express.Router();
const { verifyAuth } = require("../middleware/authMiddleware");
const systemController = require("../controllers/systemController");

/**
 * 系統更新相關端點
 */
router.get("/check-update", verifyAuth, systemController.checkUpdate);
router.post("/apply-update", verifyAuth, systemController.applyUpdate);

module.exports = router;
