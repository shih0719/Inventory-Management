const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");

router.get("/inventory", reportsController.getInventory);

module.exports = router;
