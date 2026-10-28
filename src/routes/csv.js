const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireRole } = require("../middleware/authMiddleware");
const csvController = require("../controllers/csvController");
const { failure } = require("../utils/errorItem");

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "import-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// The file type is checked in csvController.importCSV, so the error carries a code (ADR 0004).
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/** upload.single("file"), answering a file over the limit with FILE_TOO_LARGE instead of a 500. */
const uploadCsv = (req, res, next) =>
  upload.single("file")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(failure("FILE_TOO_LARGE", "File is larger than the 5MB limit", { maxMb: 5 }));
    }
    next(err);
  });

router.post("/import", requireRole(["manager", "admin"]), uploadCsv, csvController.importCSV);
router.get("/export", csvController.exportCSV);
router.get("/template", csvController.downloadTemplate);
router.get("/imports", csvController.getImportHistory);
router.get("/imports/:importId", csvController.getImportDetail);

module.exports = router;
