const express = require("express");
const router = express.Router();
const transactionsController = require("../controllers/transactionsController");
const { verifyAuth } = require("../middleware/authMiddleware");

router.get("/", verifyAuth, transactionsController.getAll);
router.get("/:id", verifyAuth, transactionsController.getById);
router.get("/product/:productId", verifyAuth, transactionsController.getByProduct);
router.post("/", verifyAuth, transactionsController.create);

module.exports = router;
