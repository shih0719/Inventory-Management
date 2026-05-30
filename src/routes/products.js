const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/authMiddleware");
const productsController = require("../controllers/productsController");

router.get("/lookup", productsController.lookup);
router.get("/", productsController.getAll);
router.get("/:id", productsController.getById);
router.post("/", requireRole(["manager", "admin"]), productsController.create);
router.get("/:sku/locations", productsController.getProductLocations);
router.put("/:id", requireRole(["manager", "admin"]), productsController.update);
router.delete("/:id", requireRole(["manager", "admin"]), productsController.softDelete);

module.exports = router;
