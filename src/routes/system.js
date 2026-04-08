const express = require("express");
const router = express.Router();
const systemController = require("../controllers/systemController");

/**
 * 系統更新相關端點
 */
router.get("/check-update", systemController.checkUpdate);
router.post("/apply-update", systemController.applyUpdate);

module.exports = router;
