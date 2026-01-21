const express = require("express");
const router = express.Router();
const batchesController = require("../controllers/batchesController");

router.post("/", batchesController.createBatch);
router.get("/", batchesController.getAllBatches);
router.get("/:id", batchesController.getBatchById);

module.exports = router;
