const db = require("../config/database");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const { logAction } = require("../services/auditService");
const stockLedger = require("../services/stockLedger");
const { errorItem, failure } = require("../utils/errorItem");

/** A per-row error or warning; `row` is the data row number, or "Header". */
const rowIssue = (row, code, reason, params = {}) => ({
  row,
  ...errorItem(row === "Header" ? undefined : `#${row}`, { code, params, reason }),
});

// Import products from CSV
async function importCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json(failure("FILE_NOT_PROVIDED", "Choose a CSV file to upload"));
    }

    // Validate file type
    const fileExt = req.file.originalname.toLowerCase().endsWith('.csv');
    if (!fileExt) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json(failure("INVALID_FILE_TYPE",
        `Only .csv files are accepted (received ${req.file.originalname})`, { fileName: req.file.originalname }));
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      fs.unlinkSync(req.file.path);
      const sizeMb = (req.file.size / 1024 / 1024).toFixed(2);
      return res.status(400).json(failure("FILE_TOO_LARGE", `File is ${sizeMb}MB; the limit is 5MB`, { maxMb: 5 }));
    }

    const results = [];
    const errors = [];
    const warnings = [];
    let rowNumber = 0;
    let isEmptyFile = true;
    let detectedEncoding = null;

    // Try to detect encoding by reading first few bytes
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 4);
    fs.closeSync(fd);

    // Detect encoding: UTF-8 BOM, or default to Big5 for Traditional Chinese
    let encoding = "big5"; // Default for Traditional Chinese environment
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      encoding = "utf8";
      detectedEncoding = "UTF-8 (BOM detected)";
    } else {
      detectedEncoding = "Big5 (Traditional Chinese)";
    }

    // Create file stream with detected encoding
    const fileStream = fs.createReadStream(req.file.path)
      .pipe(iconv.decodeStream(encoding));

    fileStream
      .pipe(csv())
      .on("headers", (headers) => {
        const required = ['SKU', 'Name', 'Type'];
        const missing = required.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          errors.push(rowIssue("Header", "INVALID_HEADERS",
            `Missing columns: ${missing.join(', ')} (expected SKU, Name, Type; found ${headers.join(', ')})`,
            { missing: missing.join(', ') }));
        }
      })
      .on("data", (data) => {
        isEmptyFile = false;
        results.push(data);
      })
      .on("end", async () => {
        const warehouseId = req.warehouseId;
        try {
          // Check if file is empty
          if (isEmptyFile || results.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json(failure("EMPTY_FILE", "The CSV has no data rows; it needs a header row and at least one data row"));
          }

          let imported = 0;
          let updated = 0;
          const duplicateSkus = new Set();

          for (const row of results) {
            rowNumber++;
            try {
              const { SKU, Name, Type, Model, IsAccount, NoAccount, MinStock } = row;

              // Check for missing required fields
              const missingFields = [];
              if (!SKU || SKU.trim() === "") missingFields.push("SKU");
              if (!Name || Name.trim() === "") missingFields.push("Name");
              if (!Type || Type.trim() === "") missingFields.push("Type");

              if (missingFields.length > 0) {
                errors.push(rowIssue(rowNumber, "MISSING_REQUIRED_FIELDS", `Missing required fields: ${missingFields.join(', ')}`,
                  { fields: missingFields.join(', ') }));
                continue;
              }

              // Validate SKU format (alphanumeric, no spaces at start/end)
              const trimmedSku = SKU.trim().toUpperCase();
              if (!/^[A-Z0-9\-_]+$/.test(trimmedSku)) {
                errors.push(rowIssue(rowNumber, "INVALID_SKU_FORMAT",
                  `Invalid SKU "${SKU}": only letters, digits, - and _ are allowed`, { sku: SKU }));
                continue;
              }

              // Check for duplicate SKUs in same import
              if (duplicateSkus.has(trimmedSku)) {
                warnings.push(rowIssue(rowNumber, "DUPLICATE_SKU_IN_IMPORT",
                  `SKU ${trimmedSku} appears more than once; the last row wins`, { sku: trimmedSku }));
              }
              duplicateSkus.add(trimmedSku);

              // Type decides AP classification: type='ap' iff track_serial=1.
              const productType = Type.trim().toLowerCase();
              if (productType !== "ap" && productType !== "normal") {
                errors.push(rowIssue(rowNumber, "INVALID_PRODUCT_TYPE",
                  `Type must be ap or normal (received "${Type}")`, { value: Type.trim() }));
                continue;
              }
              const trackSerial = productType === "ap" ? 1 : 0;

              // Validate quantities are non-negative numbers
              const accountableQty = parseInt(IsAccount) || 0;
              const nonAccountableQty = parseInt(NoAccount) || 0;

              if (isNaN(accountableQty) || accountableQty < 0) {
                errors.push(rowIssue(rowNumber, "INVALID_QUANTITY",
                  `IsAccount must be a non-negative integer (received "${IsAccount}")`, { field: "IsAccount", value: IsAccount }));
                continue;
              }

              if (isNaN(nonAccountableQty) || nonAccountableQty < 0) {
                errors.push(rowIssue(rowNumber, "INVALID_QUANTITY",
                  `NoAccount must be a non-negative integer (received "${NoAccount}")`, { field: "NoAccount", value: NoAccount }));
                continue;
              }

              // Validate MinStock
              const hasMinStock = MinStock !== undefined && MinStock !== "";
              let minStockVal = 0;
              if (hasMinStock) {
                minStockVal = parseInt(MinStock);
                if (isNaN(minStockVal) || minStockVal < 0) {
                  errors.push(rowIssue(rowNumber, "INVALID_MIN_STOCK",
                    `MinStock must be a non-negative integer (received "${MinStock}")`, { field: "MinStock", value: MinStock }));
                  continue;
                }
              }

              // CSV quantities are targets: each row writes the difference as ADJUSTMENT
              // movements through the Stock Ledger, and commits on its own.
              const wasExisting = await db.transaction(async (tx) => {
                const existing = await tx.get(
                  "SELECT id, min_stock, accountable_quantity, non_accountable_quantity, track_serial FROM products WHERE sku = ? AND warehouse_id = ?",
                  [trimmedSku, warehouseId],
                );

                // Same guard as editing a product: serial tracking stays on while APs exist.
                if (existing?.track_serial && !trackSerial) {
                  const { cnt } = await tx.get("SELECT COUNT(*) AS cnt FROM product_units WHERE product_id = ?", [existing.id]);
                  if (cnt > 0) {
                    errors.push(rowIssue(rowNumber, "PRODUCT_HAS_UNITS_TRACKING",
                      `The product still has ${cnt} serial record(s); delete them before turning off serial tracking`,
                      { count: cnt }));
                    return null;
                  }
                }

                let productId;
                if (existing) {
                  const finalMinStock = hasMinStock ? minStockVal : existing.min_stock;
                  await tx.run(
                    `UPDATE products SET name = ?, type = ?, model = ?, min_stock = ?, track_serial = ?
                     WHERE id = ?`,
                    [
                      Name.trim(),
                      productType,
                      Model ? Model.trim() : "",
                      finalMinStock,
                      trackSerial,
                      existing.id,
                    ],
                  );
                  productId = existing.id;
                } else {
                  const created = await tx.run(
                    `INSERT INTO products (sku, name, type, model, accountable_quantity, non_accountable_quantity, min_stock, track_serial, warehouse_id)
                     VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)`,
                    [
                      trimmedSku,
                      Name.trim(),
                      productType,
                      Model ? Model.trim() : "",
                      hasMinStock ? minStockVal : 0,
                      trackSerial,
                      warehouseId,
                    ],
                  );
                  productId = created.id;
                }

                const movements = [
                  { quantityType: "accountable", delta: accountableQty - (existing?.accountable_quantity || 0) },
                  { quantityType: "non_accountable", delta: nonAccountableQty - (existing?.non_accountable_quantity || 0) },
                ]
                  .filter((m) => m.delta !== 0)
                  .map((m) => ({ ...m, productId, remarks: "CSV 匯入" }));
                if (movements.length > 0) {
                  await stockLedger.apply(tx, movements, {
                    tag: { name: "ADJUSTMENT" },
                    source: "csv-import",
                    actor: { userId: req.user?.id, username: req.user?.username || "unknown" },
                  });
                }
                return Boolean(existing);
              });
              if (wasExisting === null) continue;
              if (wasExisting) updated++;
              else imported++;
            } catch (error) {
              if (error instanceof stockLedger.LedgerError) {
                // The ledger's own code says why the quantity was rejected.
                const { code, params, error: reason } = error.toBody();
                errors.push(rowIssue(rowNumber, code, reason, params));
                continue;
              }
              // Database constraint violation
              if (error.message.includes("UNIQUE constraint failed")) {
                const sku = (row.SKU || '').trim();
                errors.push(rowIssue(rowNumber, "DUPLICATE_SKU", `SKU ${sku} already exists`, { sku }));
              } else {
                errors.push(rowIssue(rowNumber, "DATABASE_ERROR", `Database operation failed: ${error.message}`));
              }
            }
          }

          // Clean up uploaded file
          try {
            if (fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
          } catch (cleanupError) {
            console.error("Warning: Could not delete temp file:", cleanupError);
          }

          // Check if there are errors that prevent success
          if (errors.length > 0 && imported === 0 && updated === 0) {
            return res.status(400).json({
              ...failure("IMPORT_FAILED", `Import failed with ${errors.length} error(s)`, { count: errors.length }, errors),
              imported: 0,
              updated: 0,
              warnings: warnings.length > 0 ? warnings : undefined
            });
          }

          // Record import to csv_imports table
          try {
            const importDetails = {
              total_rows: results.length,
              new_products: imported,
              updated_products: updated,
              errors: errors.length,
              warnings: warnings.length
            };

            const importResult = await db.run(
              `INSERT INTO csv_imports (created_by_user, imported_count, updated_count, error_count, file_name, encoding, details)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                req.user?.username || 'unknown',
                imported,
                updated,
                errors.length,
                req.file.originalname,
                detectedEncoding,
                JSON.stringify(importDetails)
              ]
            );

            const importId = importResult.id;

            await logAction(
              req.user?.id || null,
              'CREATE',
              'csv_import',
              importId,
              warehouseId
            );

            // Partial success
            res.json({
              success: true,
              message: `Import complete: ${imported} added, ${updated} updated.`,
              import_id: importId,
              imported,
              updated,
              encoding: detectedEncoding,
              errors: errors.length > 0 ? errors : undefined,
              warnings: warnings.length > 0 ? warnings : undefined,
            });
          } catch (auditError) {
            console.error("Warning: Failed to record import:", auditError);
            // Still return success, but log the audit error
            res.json({
              success: true,
              message: `Import complete: ${imported} added, ${updated} updated. (Warning: the audit log could not be recorded)`,
              imported,
              updated,
              encoding: detectedEncoding,
              errors: errors.length > 0 ? errors : undefined,
              warnings: warnings.length > 0 ? warnings : undefined,
            });
          }
        } catch (error) {
          console.error("Error processing CSV:", error);
          res.status(500).json(failure("PROCESSING_ERROR", `Failed to process the CSV: ${error.message}`));
        }
      })
      .on("error", (error) => {
        // Clean up uploaded file
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (e) {
          console.error("Warning: Could not delete temp file:", e);
        }

        console.error("CSV parsing error:", error);
        res.status(400).json(failure("CSV_PARSE_ERROR",
          `Cannot parse the CSV (${error.message}); the file may be damaged or not UTF-8 / Big5 encoded`));
      });
  } catch (error) {
    console.error("Error importing CSV:", error);
    res.status(500).json(failure("SERVER_ERROR", `Server error: ${error.message}`));
  }
}

// Export products to CSV
async function exportCSV(req, res) {
  try {
    const warehouseId = req.warehouseId;
    const { skus } = req.query;

    const products = await db.all(
      `SELECT sku, name, track_serial, model, accountable_quantity, non_accountable_quantity, min_stock
       FROM products
       WHERE is_deleted = 0 AND warehouse_id = ?
       ORDER BY sku ASC`,
      [warehouseId],
    );

    // If the client provides an explicit SKU ordering (from manual row reordering),
    // export in that order; otherwise fall back to the DB ordering (sku ASC).
    let exportData;
    if (skus) {
      const order = skus.split(",").map((s) => s.trim()).filter(Boolean);
      const bySku = new Map(products.map((p) => [p.sku, p]));
      const ordered = order.map((s) => bySku.get(s)).filter((p) => !!p);
      const seen = new Set(order);
      for (const p of products) if (!seen.has(p.sku)) ordered.push(p);
      exportData = ordered;
    } else {
      exportData = products;
    }

    const rows = exportData.map((product) => ({
      SKU: product.sku,
      Name: product.name,
      Type: product.track_serial ? "ap" : "normal",
      Model: product.model || "",
      IsAccount: product.accountable_quantity,
      NoAccount: product.non_accountable_quantity,
      MinStock: product.min_stock,
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
        { id: "MinStock", title: "MinStock" },
      ],
    });

    await csvWriter.writeRecords(rows);
    
    // Convert to ANSI (Big5) for Excel compatibility in Traditional Chinese environment
    const content = fs.readFileSync(filepath, "utf8");
    const big5Buffer = iconv.encode(content, "big5");
    fs.writeFileSync(filepath, big5Buffer);

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

// Get CSV import history
async function getImportHistory(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const imports = await db.all(
      `SELECT id, created_by_user, imported_count, updated_count, error_count, file_name, encoding, details, created_at
       FROM csv_imports
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    const countResult = await db.get("SELECT COUNT(*) as total FROM csv_imports");
    const total = countResult?.total || 0;

    // Parse details JSON
    const data = imports.map(imp => ({
      ...imp,
      details: imp.details ? JSON.parse(imp.details) : null
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total,
        offset: parseInt(offset),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching import history:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Get single import details
async function getImportDetail(req, res) {
  try {
    const { importId } = req.params;

    const importRecord = await db.get(
      "SELECT * FROM csv_imports WHERE id = ?",
      [importId]
    );

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        error: "Import record not found"
      });
    }

    res.json({
      success: true,
      data: {
        ...importRecord,
        details: importRecord.details ? JSON.parse(importRecord.details) : null
      }
    });
  } catch (error) {
    console.error("Error fetching import detail:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  importCSV,
  exportCSV,
  downloadTemplate,
  getImportHistory,
  getImportDetail,
};
