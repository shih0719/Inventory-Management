const express = require("express");
const router = express.Router();
const tagsController = require("../controllers/tagsController");

router.get("/", tagsController.getAll);

module.exports = router;
