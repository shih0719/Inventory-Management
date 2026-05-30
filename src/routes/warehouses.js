const express = require("express");
const router = express.Router();
const { verifyAuth, requireRole } = require("../middleware/authMiddleware");
const warehouseController = require("../controllers/warehouseController");

router.get("/", verifyAuth, warehouseController.getAll);
router.post("/", verifyAuth, requireRole(["admin"]), warehouseController.create);
router.put("/:id", verifyAuth, requireRole(["admin"]), warehouseController.update);
router.delete("/:id", verifyAuth, requireRole(["admin"]), warehouseController.remove);

module.exports = router;
