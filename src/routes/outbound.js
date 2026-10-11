const express = require("express");
const router = express.Router();
const outboundController = require("../controllers/outboundController");
const { requireRole } = require("../middleware/authMiddleware");

router.post("/", requireRole(["manager", "admin"]), outboundController.create);

module.exports = router;
