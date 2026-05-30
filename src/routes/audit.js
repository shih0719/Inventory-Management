const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");
const { requireRole } = require("../middleware/authMiddleware");

router.get("/", requireRole(["admin"]), auditController.getAuditLogs);

module.exports = router;
