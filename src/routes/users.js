const express = require("express");
const router = express.Router();
const { verifyAuth, requireRole } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

router.get("/", verifyAuth, requireRole(["admin"]), userController.getAll);
router.post("/", verifyAuth, requireRole(["admin"]), userController.create);
router.put("/:id", verifyAuth, requireRole(["admin"]), userController.update);
router.delete("/:id", verifyAuth, requireRole(["admin"]), userController.remove);

module.exports = router;
