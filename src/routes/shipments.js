const express = require("express");
const router = express.Router();
const shipmentsController = require("../controllers/shipmentsController");

router.post("/", shipmentsController.create);
router.get("/", shipmentsController.getAll);
router.get("/:id", shipmentsController.getById);
router.put("/:id", shipmentsController.update);
router.delete("/:id", shipmentsController.delete);

module.exports = router;
