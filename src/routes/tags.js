const express = require("express");
const router = express.Router();
const { verifyAuth } = require("../middleware/authMiddleware");
const tagsController = require("../controllers/tagsController");

router.get("/", verifyAuth, tagsController.getAll);

module.exports = router;
