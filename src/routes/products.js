const express = require("express");
const router = express.Router();
const { verifyAuth } = require("../middleware/authMiddleware");
const productsController = require("../controllers/productsController");

// Public: GET requests allowed without auth
router.get("/", productsController.getAll);
router.get("/:id", productsController.getById);

// Protected: All other operations require auth
router.post("/", verifyAuth, productsController.create);
router.get("/:sku/locations", verifyAuth, productsController.getProductLocations);
router.put("/:id", verifyAuth, productsController.update);
router.delete("/:id", verifyAuth, productsController.softDelete);

module.exports = router;
