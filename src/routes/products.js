const express = require("express");
const router = express.Router();
const productsController = require("../controllers/productsController");

router.get("/", productsController.getAll);
router.get("/:id", productsController.getById);
router.post("/", productsController.create);
router.put("/:id", productsController.update);
router.delete("/:id", productsController.softDelete);

module.exports = router;
