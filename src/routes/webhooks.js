const express = require("express");
const router = express.Router();
const webhooksController = require("../controllers/webhooksController");

router.get("/", webhooksController.getAll);
router.post("/", webhooksController.create);
router.put("/:id", webhooksController.update);
router.delete("/:id", webhooksController.remove);
router.get("/:id/logs", webhooksController.getLogs);
router.post("/:id/test", webhooksController.test);

module.exports = router;
