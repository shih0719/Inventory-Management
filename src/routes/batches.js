const express = require("express");
const router = express.Router();
const batchesController = require("../controllers/batchesController");
const { requireRole } = require("../middleware/authMiddleware");

router.post("/", requireRole(["manager", "admin"]), batchesController.createBatch);
router.get("/", batchesController.getAllBatches);
router.get("/:id", batchesController.getBatchById);

module.exports = router;
