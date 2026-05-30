const express = require("express");
const router = express.Router();
const shipmentsController = require("../controllers/shipmentsController");
const { requireRole } = require("../middleware/authMiddleware");

router.post("/", requireRole(["manager", "admin"]), shipmentsController.create);
router.get("/", shipmentsController.getAll);
router.get("/:id", shipmentsController.getById);
router.put("/:id", requireRole(["manager", "admin"]), shipmentsController.update);
router.delete("/:id", requireRole(["manager", "admin"]), shipmentsController.delete);

module.exports = router;
