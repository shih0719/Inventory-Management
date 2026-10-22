const express = require("express");
const router = express.Router();
const c = require("../controllers/productUnitsController");
const { requireRole } = require("../middleware/authMiddleware");

router.get("/export", c.exportCSV);
router.get("/lookup/:serial", c.lookupBySerial);
router.get("/", c.getAll);
router.get("/:id", c.getById);
router.post("/bulk", requireRole(["manager", "admin"]), c.bulkCreate);
router.post("/transfer", requireRole(["manager", "admin"]), c.transfer);
router.post("/", requireRole(["manager", "admin"]), c.create);
router.put("/:id", requireRole(["manager", "admin"]), c.update);
router.delete("/:id", requireRole(["manager", "admin"]), c.remove);

module.exports = router;
