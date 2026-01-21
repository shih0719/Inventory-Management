const db = require("../config/database");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

// Import products from CSV
async function importCSV(req, res) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const results = [];
    const errors = [];
    let rowNumber = 0;

    // Use iconv-lite to convert ANSI (Big5/GBK) to UTF-8
    fs.createReadStream(req.file.path)
      .pipe(iconv.decodeStream("big5"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        let imported = 0;
        let updated = 0;

        for (const row of results) {
          rowNumber++;
          try {
            const { SKU, Name, Type, Model, IsAccount, NoAccount } = row;

            if (!SKU || !Name || !Type) {
              errors.push(
                `Row ${rowNumber}: Missing required fields (SKU, Name, Type)`,
              );
              continue;
            }

            const accountableQty = parseInt(IsAccount) || 0;
            const nonAccountableQty = parseInt(NoAccount) || 0;

            // Check if product exists
            const existing = await db.get(
              "SELECT id FROM products WHERE sku = ?",
              [SKU],
            );

            if (existing) {
              await db.run(
                `UPDATE products SET name = ?, type = ?, model = ?, 
                 accountable_quantity = ?, non_accountable_quantity = ? 
                 WHERE sku = ?`,
                [
                  Name,
                  Type,
                  Model || "",
                  accountableQty,
                  nonAccountableQty,
                  SKU,
                ],
              );
              updated++;
            } else {
              await db.run(
                `INSERT INTO products (sku, name, type, model, accountable_quantity, non_accountable_quantity) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  SKU,
                  Name,
                  Type,
                  Model || "",
                  accountableQty,
                  nonAccountableQty,
                ],
              );
              imported++;
            }
          } catch (error) {
            errors.push(`Row ${rowNumber}: ${error.message}`);
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          message: `Import completed. ${imported} new products, ${updated} updated.`,
          imported,
          updated,
          errors: errors.length > 0 ? errors : undefined,
        });
      })
      .on("error", (error) => {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: error.message });
      });
  } catch (error) {
    console.error("Error importing CSV:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Export products to CSV
async function exportCSV(req, res) {
  try {
    const products = await db.all(
      `SELECT sku, name, type, model, accountable_quantity, non_accountable_quantity
       FROM products 
       WHERE is_deleted = 0
       ORDER BY sku ASC`,
    );

    const exportData = products.map((product) => ({
      SKU: product.sku,
      Name: product.name,
      Type: product.type,
      Model: product.model || "",
      IsAccount: product.accountable_quantity,
      NoAccount: product.non_accountable_quantity,
    }));

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `inventory_export_${timestamp}.csv`;
    const filepath = path.join(__dirname, "../../uploads", filename);

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: "SKU", title: "SKU" },
        { id: "Name", title: "Name" },
        { id: "Type", title: "Type" },
        { id: "Model", title: "Model" },
        { id: "IsAccount", title: "IsAccount" },
        { id: "NoAccount", title: "NoAccount" },
      ],
    });

    await csvWriter.writeRecords(exportData);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
      }
      // Clean up file after download
      fs.unlinkSync(filepath);
    });
  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Download CSV template
async function downloadTemplate(req, res) {
  try {
    const templatePath = path.join(__dirname, "../../database/sample.csv");

    if (!fs.existsSync(templatePath)) {
      return res
        .status(404)
        .json({ success: false, error: "Template file not found" });
    }

    res.download(templatePath, "inventory_template.csv", (err) => {
      if (err) {
        console.error("Error downloading template:", err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
  } catch (error) {
    console.error("Error downloading template:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  importCSV,
  exportCSV,
  downloadTemplate,
};
