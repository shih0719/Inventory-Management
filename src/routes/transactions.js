const express = require("express");
const router = express.Router();
const transactionsController = require("../controllers/transactionsController");
const { requireRole } = require("../middleware/authMiddleware");

// Static/export routes must be registered before the /:id route.
router.get("/export", transactionsController.exportCSV);
router.get("/product/:productId", transactionsController.getByProduct);
router.get("/", transactionsController.getAll);
router.get("/:id", transactionsController.getById);
router.post("/", requireRole(["manager", "admin"]), transactionsController.create);

module.exports = router;
