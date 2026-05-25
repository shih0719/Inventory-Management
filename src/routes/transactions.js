const express = require("express");
const router = express.Router();
const transactionsController = require("../controllers/transactionsController");
const { verifyAuth } = require("../middleware/authMiddleware");

router.get("/", transactionsController.getAll);
router.get("/:id", transactionsController.getById);
router.get("/product/:productId", transactionsController.getByProduct);
router.post("/", verifyAuth, transactionsController.create);

module.exports = router;
