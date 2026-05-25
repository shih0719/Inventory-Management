const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");
const { verifyAuth } = require("../middleware/authMiddleware");

// Require auth for audit logs
router.get("/", verifyAuth, auditController.getAuditLogs);

module.exports = router;
