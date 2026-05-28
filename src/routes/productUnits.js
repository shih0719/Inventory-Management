const express = require("express");
const router = express.Router();
const { verifyAuth } = require("../middleware/authMiddleware");
const c = require("../controllers/productUnitsController");

router.get("/export", verifyAuth, c.exportCSV);
router.get("/", verifyAuth, c.getAll);
router.get("/:id", verifyAuth, c.getById);
router.post("/bulk", verifyAuth, c.bulkCreate);
router.post("/bulk-sell", verifyAuth, c.bulkSell);
router.post("/", verifyAuth, c.create);
router.put("/:id", verifyAuth, c.update);
router.delete("/:id", verifyAuth, c.remove);

module.exports = router;
