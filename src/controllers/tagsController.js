const db = require("../config/database");

// Get all predefined tags
async function getAll(req, res) {
  try {
    const tags = await db.all("SELECT * FROM tags ORDER BY id ASC");
    res.json({ success: true, data: tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAll,
};
