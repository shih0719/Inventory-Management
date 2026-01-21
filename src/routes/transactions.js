const express = require("express");
const router = express.Router();
const transactionsController = require("../controllers/transactionsController");

router.get("/", transactionsController.getAll);
router.get("/product/:productId", transactionsController.getByProduct);
router.post("/", transactionsController.create);

module.exports = router;
