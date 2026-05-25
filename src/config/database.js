const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const DB_PATH = process.env.DB_PATH || "./database/inventory.db";
const SCHEMA_PATH = path.join(__dirname, "../../database/schema.sql");
const SEEDS_PATH = path.join(__dirname, "../../database/seeds.sql");

let db = null;

// Initialize database connection
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Ensure database directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create database connection
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Database connection failed:", err.message);
        reject(err);
        return;
      }
      console.log("✅ Connected to SQLite database");
    });

    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON", (err) => {
      if (err) {
        console.error("❌ Failed to enable foreign keys:", err.message);
        reject(err);
        return;
      }
    });

    // Enable WAL mode for better concurrency
    db.run("PRAGMA journal_mode = WAL", (err) => {
      if (err) {
        console.error("❌ Failed to enable WAL mode:", err.message);
      }
    });

    // Execute schema
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    db.exec(schema, (err) => {
      if (err) {
        console.error("❌ Schema execution failed:", err.message);
        reject(err);
        return;
      }
      console.log("✅ Database schema initialized");

      // Migration: add missing columns
      db.all("PRAGMA table_info(products)", (err, columns) => {
        if (err) {
          console.error("❌ Failed to inspect products table:", err.message);
          reject(err);
          return;
        }
        const hasMinStock = columns.some((c) => c.name === "min_stock");
        const hasTrackSerial = columns.some((c) => c.name === "track_serial");

        const ensureMinStock = hasMinStock
          ? Promise.resolve()
          : new Promise((res, rej) => {
              db.run(
                "ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0",
                (e) => {
                  if (e) rej(e);
                  else { console.log("✅ Added min_stock column to products"); res(); }
                },
              );
            });

        const ensureTrackSerial = hasTrackSerial
          ? Promise.resolve()
          : new Promise((res, rej) => {
              db.run(
                "ALTER TABLE products ADD COLUMN track_serial INTEGER NOT NULL DEFAULT 0",
                (e) => {
                  if (e) rej(e);
                  else { console.log("✅ Added track_serial column to products"); res(); }
                },
              );
            });

        ensureMinStock
          .then(() => ensureTrackSerial)
          .then(() => {
            // Check and add product_unit_ids to transactions table
            db.all("PRAGMA table_info(transactions)", (err, trxColumns) => {
              if (err) {
                console.error("❌ Failed to inspect transactions table:", err.message);
                reject(err);
                return;
              }
              const hasProductUnitIds = trxColumns.some((c) => c.name === "product_unit_ids");
              const hasCreatedByUser = trxColumns.some((c) => c.name === "created_by_user");

              const addProductUnitIds = hasProductUnitIds
                ? Promise.resolve()
                : new Promise((res, rej) => {
                    db.run(
                      "ALTER TABLE transactions ADD COLUMN product_unit_ids TEXT",
                      (e) => {
                        if (e) rej(e);
                        else { console.log("✅ Added product_unit_ids column to transactions"); res(); }
                      }
                    );
                  });

              const addCreatedByUser = hasCreatedByUser
                ? Promise.resolve()
                : new Promise((res, rej) => {
                    db.run(
                      "ALTER TABLE transactions ADD COLUMN created_by_user TEXT",
                      (e) => {
                        if (e) rej(e);
                        else { console.log("✅ Added created_by_user column to transactions"); res(); }
                      }
                    );
                  });

              addProductUnitIds
                .then(() => addCreatedByUser)
                .then(() => ensureAuthAndAuditTables())
                .then(loadSeeds)
                .catch((e) => {
                  console.error("❌ Migration failed:", e.message);
                  reject(e);
                });
            });
          })
          .catch((e) => {
            console.error("❌ Migration failed:", e.message);
            reject(e);
          });
      });

      function ensureAuthAndAuditTables() {
        return new Promise((res, rej) => {
          // Create users table if not exists
          db.run(
            `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            (e1) => {
              if (e1) {
                rej(e1);
                return;
              }
              console.log("✅ Users table ready");

              // Create audit_logs table if not exists
              db.run(
                `CREATE TABLE IF NOT EXISTS audit_logs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')),
                  resource_type TEXT NOT NULL,
                  resource_id INTEGER NOT NULL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id)
                )`,
                (e2) => {
                  if (e2) {
                    rej(e2);
                    return;
                  }
                  console.log("✅ Audit logs table ready");

                  // Add created_by_user to batches if needed
                  db.all("PRAGMA table_info(batches)", (err, batchColumns) => {
                    if (err) {
                      rej(err);
                      return;
                    }
                    const hasCreatedByUser = batchColumns.some((c) => c.name === "created_by_user");
                    if (hasCreatedByUser) {
                      checkShipments();
                    } else {
                      db.run(
                        "ALTER TABLE batches ADD COLUMN created_by_user TEXT",
                        (e) => {
                          if (e) rej(e);
                          else { console.log("✅ Added created_by_user to batches"); checkShipments(); }
                        }
                      );
                    }
                  });
                }
              );
            }
          );

          function checkShipments() {
            db.all("PRAGMA table_info(shipments)", (err, shipColumns) => {
              if (err) {
                rej(err);
                return;
              }
              const hasCreatedByUser = shipColumns.some((c) => c.name === "created_by_user");
              if (hasCreatedByUser) {
                res();
              } else {
                db.run(
                  "ALTER TABLE shipments ADD COLUMN created_by_user TEXT",
                  (e) => {
                    if (e) rej(e);
                    else { console.log("✅ Added created_by_user to shipments"); res(); }
                  }
                );
              }
            });
          }
        });
      }

      function loadSeeds() {
        const seeds = fs.readFileSync(SEEDS_PATH, "utf8");
        db.exec(seeds, (err) => {
          if (err) {
            console.error("❌ Seeds execution failed:", err.message);
            reject(err);
            return;
          }
          console.log("✅ Seed data loaded");
          createDefaultUserIfNotExists();
        });
      }

      function createDefaultUserIfNotExists() {
        // Check if default user already exists
        db.all("SELECT id FROM users WHERE username = 'eric' LIMIT 1", (checkErr, rows) => {
          if (checkErr) {
            console.error("❌ Failed to check for default user:", checkErr.message);
            resolve(db);
            return;
          }

          if (rows && rows.length > 0) {
            console.log("✅ Default user 'eric' already exists");
            resolve(db);
            return;
          }

          // Create default user with bcrypt
          const bcrypt = require("bcrypt");
          bcrypt.hash("password", 10, (hashErr, passwordHash) => {
            if (hashErr) {
              console.error("❌ Failed to hash password:", hashErr.message);
              resolve(db);
              return;
            }

            db.run(
              "INSERT INTO users (username, password_hash) VALUES (?, ?)",
              ["eric", passwordHash],
              function (insertErr) {
                if (insertErr) {
                  console.error("❌ Failed to create default user:", insertErr.message);
                } else {
                  console.log("✅ Default user 'eric' created (password: 'password')");
                }
                resolve(db);
              }
            );
          });
        });
      }
    });
  });
}

// Promisified database methods
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log("✅ Database connection closed");
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  run,
  get,
  all,
  closeDatabase,
  getDb: () => db,
};
