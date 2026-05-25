const express = require("express");
const router = express.Router();
const shipmentsController = require("../controllers/shipmentsController");
const { verifyAuth } = require("../middleware/authMiddleware");

router.post("/", verifyAuth, shipmentsController.create);
router.get("/", shipmentsController.getAll);
router.get("/:id", shipmentsController.getById);
router.put("/:id", verifyAuth, shipmentsController.update);
router.delete("/:id", verifyAuth, shipmentsController.delete);

module.exports = router;
