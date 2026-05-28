const express = require("express");
const router = express.Router();
const { verifyAuth } = require("../middleware/authMiddleware");
const webhooksController = require("../controllers/webhooksController");

router.get("/", verifyAuth, webhooksController.getAll);
router.post("/", verifyAuth, webhooksController.create);
router.put("/:id", verifyAuth, webhooksController.update);
router.delete("/:id", verifyAuth, webhooksController.remove);
router.get("/:id/logs", verifyAuth, webhooksController.getLogs);
router.post("/:id/test", verifyAuth, webhooksController.test);

module.exports = router;
