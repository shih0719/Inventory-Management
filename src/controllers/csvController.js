const db = require("../config/database");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const { logAction } = require("../services/auditService");

// Import products from CSV
async function importCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
        reason: "FILE_NOT_PROVIDED",
        message: "請選擇一個CSV檔案進行上傳",
        details: "未偵測到上傳的檔案"
      });
    }

    // Validate file type
    const allowedMimes = ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv'];
    const fileExt = req.file.originalname.toLowerCase().endsWith('.csv');
    if (!fileExt) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: "Invalid file type",
        reason: "INVALID_FILE_TYPE",
        message: "只接受CSV檔案格式",
        details: `上傳的檔案格式為: ${req.file.originalname}. 請使用 .csv 檔案`
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: "File too large",
        reason: "FILE_TOO_LARGE",
        message: "檔案大小超過限制",
        details: `檔案大小: ${(req.file.size / 1024 / 1024).toFixed(2)}MB, 最大限制: 5MB`
      });
    }

    const results = [];
    const errors = [];
    const warnings = [];
    let rowNumber = 0;
    let isEmptyFile = true;
    let headersFound = false;
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
        headersFound = true;
        const required = ['SKU', 'Name', 'Type'];
        const missing = required.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          errors.push({
            row: "Header",
            reason: "INVALID_HEADERS",
            message: `缺少必要的欄位: ${missing.join(', ')}`,
            details: `預期欄位: SKU, Name, Type\n實際欄位: ${headers.join(', ')}`
          });
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
            return res.status(400).json({
              success: false,
              error: "Empty file",
              reason: "EMPTY_FILE",
              message: "CSV檔案為空",
              details: "檔案沒有包含任何數據行。請確保CSV檔案至少包含標題行和一行數據"
            });
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
                errors.push({
                  row: rowNumber,
                  reason: "MISSING_REQUIRED_FIELDS",
                  message: `缺少必要欄位: ${missingFields.join(', ')}`,
                  details: `行 ${rowNumber} 的必要欄位不能為空。已收到: SKU="${SKU}", Name="${Name}", Type="${Type}"`
                });
                continue;
              }

              // Validate SKU format (alphanumeric, no spaces at start/end)
              const trimmedSku = SKU.trim().toUpperCase();
              if (!/^[A-Z0-9\-_]+$/.test(trimmedSku)) {
                errors.push({
                  row: rowNumber,
                  reason: "INVALID_SKU_FORMAT",
                  message: "SKU格式無效",
                  details: `SKU 只能包含字母、數字、連字號和下劃線。收到: "${SKU}"`
                });
                continue;
              }

              // Check for duplicate SKUs in same import
              if (duplicateSkus.has(trimmedSku)) {
                warnings.push({
                  row: rowNumber,
                  reason: "DUPLICATE_SKU_IN_IMPORT",
                  message: `SKU 在此導入中重複: ${trimmedSku}`,
                  details: `此 SKU 已在前面的行中出現。將使用最後一次出現的數據`
                });
              }
              duplicateSkus.add(trimmedSku);

              // Validate quantities are non-negative numbers
              const accountableQty = parseInt(IsAccount) || 0;
              const nonAccountableQty = parseInt(NoAccount) || 0;

              if (isNaN(accountableQty) || accountableQty < 0) {
                errors.push({
                  row: rowNumber,
                  reason: "INVALID_QUANTITY",
                  message: "可計數數量 (IsAccount) 無效",
                  details: `必須是非負整數。收到: "${IsAccount}"`
                });
                continue;
              }

              if (isNaN(nonAccountableQty) || nonAccountableQty < 0) {
                errors.push({
                  row: rowNumber,
                  reason: "INVALID_QUANTITY",
                  message: "不可計數數量 (NoAccount) 無效",
                  details: `必須是非負整數。收到: "${NoAccount}"`
                });
                continue;
              }

              // Validate MinStock
              const hasMinStock = MinStock !== undefined && MinStock !== "";
              let minStockVal = 0;
              if (hasMinStock) {
                minStockVal = parseInt(MinStock);
                if (isNaN(minStockVal) || minStockVal < 0) {
                  errors.push({
                    row: rowNumber,
                    reason: "INVALID_MIN_STOCK",
                    message: "最低庫存量 (MinStock) 無效",
                    details: `必須是非負整數。收到: "${MinStock}"`
                  });
                  continue;
                }
              }

              // Check if product exists in this warehouse
              const existing = await db.get(
                "SELECT id, min_stock FROM products WHERE sku = ? AND warehouse_id = ?",
                [trimmedSku, warehouseId],
              );

              if (existing) {
                const finalMinStock = hasMinStock ? minStockVal : existing.min_stock;
                await db.run(
                  `UPDATE products SET name = ?, type = ?, model = ?,
                   accountable_quantity = ?, non_accountable_quantity = ?, min_stock = ?
                   WHERE sku = ? AND warehouse_id = ?`,
                  [
                    Name.trim(),
                    Type.trim(),
                    Model ? Model.trim() : "",
                    accountableQty,
                    nonAccountableQty,
                    finalMinStock,
                    trimmedSku,
                    warehouseId,
                  ],
                );
                updated++;
              } else {
                await db.run(
                  `INSERT INTO products (sku, name, type, model, accountable_quantity, non_accountable_quantity, min_stock, warehouse_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    trimmedSku,
                    Name.trim(),
                    Type.trim(),
                    Model ? Model.trim() : "",
                    accountableQty,
                    nonAccountableQty,
                    hasMinStock ? minStockVal : 0,
                    warehouseId,
                  ],
                );
                imported++;
              }
            } catch (error) {
              // Database constraint violation
              if (error.message.includes("UNIQUE constraint failed")) {
                errors.push({
                  row: rowNumber,
                  reason: "DUPLICATE_SKU",
                  message: "SKU 已存在於資料庫中",
                  details: `SKU "${(row.SKU || '').trim()}" 在資料庫中已存在。如要更新，請確認 SKU 拼寫正確`
                });
              } else {
                errors.push({
                  row: rowNumber,
                  reason: "DATABASE_ERROR",
                  message: "資料庫操作失敗",
                  details: error.message
                });
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
              success: false,
              reason: "IMPORT_FAILED",
              message: "導入失敗。請修正以下問題:",
              imported: 0,
              updated: 0,
              errors: errors,
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
              message: `導入完成。新增 ${imported} 個產品，更新 ${updated} 個產品。`,
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
              message: `導入完成。新增 ${imported} 個產品，更新 ${updated} 個產品。(警告：無法記錄審計日誌)`,
              imported,
              updated,
              encoding: detectedEncoding,
              errors: errors.length > 0 ? errors : undefined,
              warnings: warnings.length > 0 ? warnings : undefined,
            });
          }
        } catch (error) {
          console.error("Error processing CSV:", error);
          res.status(500).json({
            success: false,
            error: error.message,
            reason: "PROCESSING_ERROR",
            message: "處理CSV時發生錯誤",
            details: error.message
          });
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
        res.status(400).json({
          success: false,
          error: error.message,
          reason: "CSV_PARSE_ERROR",
          message: "無法解析CSV檔案",
          details: "檔案可能已損壞或編碼不正確。請確保是有效的CSV格式，並使用UTF-8或Big5編碼"
        });
      });
  } catch (error) {
    console.error("Error importing CSV:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      reason: "SERVER_ERROR",
      message: "伺服器錯誤",
      details: error.message
    });
  }
}

// Export products to CSV
async function exportCSV(req, res) {
  try {
    const warehouseId = req.warehouseId;
    const products = await db.all(
      `SELECT sku, name, type, model, accountable_quantity, non_accountable_quantity, min_stock
       FROM products
       WHERE is_deleted = 0 AND warehouse_id = ?
       ORDER BY sku ASC`,
      [warehouseId],
    );

    const exportData = products.map((product) => ({
      SKU: product.sku,
      Name: product.name,
      Type: product.type,
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

    await csvWriter.writeRecords(exportData);
    
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
