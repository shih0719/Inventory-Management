const express = require("express");
const router = express.Router();
const c = require("../controllers/productUnitsController");

router.get("/export", c.exportCSV);
router.get("/", c.getAll);
router.get("/:id", c.getById);
router.post("/bulk", c.bulkCreate);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

module.exports = router;
