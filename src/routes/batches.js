const express = require("express");
const router = express.Router();
const batchesController = require("../controllers/batchesController");
const { verifyAuth } = require("../middleware/authMiddleware");

router.post("/", verifyAuth, batchesController.createBatch);
router.get("/", batchesController.getAllBatches);
router.get("/:id", batchesController.getBatchById);

module.exports = router;
