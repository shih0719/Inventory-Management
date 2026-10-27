const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");
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
          .then(() => syncProductTypeAndTrackSerial())
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
              const hasQuantityBefore = trxColumns.some((c) => c.name === "quantity_before");
              const hasQuantityAfter = trxColumns.some((c) => c.name === "quantity_after");
              const hasSource = trxColumns.some((c) => c.name === "source");

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

              const addQuantityBefore = hasQuantityBefore
                ? Promise.resolve()
                : new Promise((res, rej) => {
                    db.run(
                      "ALTER TABLE transactions ADD COLUMN quantity_before INTEGER",
                      (e) => {
                        if (e) rej(e);
                        else { console.log("✅ Added quantity_before column to transactions"); res(); }
                      }
                    );
                  });

              const addQuantityAfter = hasQuantityAfter
                ? Promise.resolve()
                : new Promise((res, rej) => {
                    db.run(
                      "ALTER TABLE transactions ADD COLUMN quantity_after INTEGER",
                      (e) => {
                        if (e) rej(e);
                        else { console.log("✅ Added quantity_after column to transactions"); res(); }
                      }
                    );
                  });

              const addSource = hasSource
                ? Promise.resolve()
                : new Promise((res, rej) => {
                    db.run(
                      "ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'adjust', 'batch', 'ap-bulk', 'ap-sell', 'ap-transfer', 'csv-import', 'shipment'))",
                      (e) => {
                        if (e) rej(e);
                        else { console.log("✅ Added source column to transactions"); res(); }
                      }
                    );
                  });

              addProductUnitIds
                .then(() => addCreatedByUser)
                .then(() => addQuantityBefore)
                .then(() => addQuantityAfter)
                .then(() => addSource)
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

      // Keep products.type in sync with track_serial: type='ap' iff track_serial=1.
      // This reconciles legacy rows where the two drifted apart.
      function syncProductTypeAndTrackSerial() {
        return new Promise((res, rej) => {
          db.run(
            `UPDATE products
               SET type = CASE WHEN track_serial = 1 THEN 'ap' ELSE 'normal' END
             WHERE type IS NULL OR (type = 'ap' AND track_serial != 1) OR (type = 'normal' AND track_serial = 1)`,
            (e) => {
              if (e) {
                console.error("❌ Failed to sync product type/track_serial:", e.message);
                rej(e);
                return;
              }
              console.log("✅ Synced products.type with track_serial");
              res();
            },
          );
        });
      }

      function ensureAuthAndAuditTables() {
        return new Promise((res, rej) => {
          // Create users table if not exists
          db.run(
            `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT,
              role TEXT NOT NULL DEFAULT 'view' CHECK(role IN ('admin','manager','view')),
              provider TEXT NOT NULL DEFAULT 'local',
              email TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            (e1) => {
              if (e1) {
                rej(e1);
                return;
              }
              // Migrate existing users table: add missing columns
              db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'view' CHECK(role IN ('admin','manager','view'))", () => {});
              db.run("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'", () => {});
              db.run("ALTER TABLE users ADD COLUMN email TEXT", () => {});

              console.log("✅ Users table ready");

              // Create audit_logs table if not exists
              db.run(
                `CREATE TABLE IF NOT EXISTS audit_logs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER,
                  action TEXT NOT NULL,
                  resource_type TEXT NOT NULL,
                  resource_id INTEGER,
                  warehouse_id INTEGER,
                  event_category TEXT NOT NULL DEFAULT 'transaction',
                  metadata TEXT,
                  ip_address TEXT,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                (e2) => {
                  if (e2) {
                    rej(e2);
                    return;
                  }
                  // Migrate existing audit_logs: add missing columns
                  db.run("ALTER TABLE audit_logs ADD COLUMN warehouse_id INTEGER", () => {});
                  db.run("ALTER TABLE audit_logs ADD COLUMN event_category TEXT NOT NULL DEFAULT 'transaction'", () => {});
                  db.run("ALTER TABLE audit_logs ADD COLUMN metadata TEXT", () => {});
                  db.run("ALTER TABLE audit_logs ADD COLUMN ip_address TEXT", () => {});
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
              const addCol = hasCreatedByUser
                ? Promise.resolve()
                : new Promise((r, j) => {
                    db.run("ALTER TABLE shipments ADD COLUMN created_by_user TEXT", (e) => {
                      if (e) j(e);
                      else { console.log("✅ Added created_by_user to shipments"); r(); }
                    });
                  });

              addCol.then(() => ensureWarehouseTables()).then(res).catch(rej);
            });
          }

          function ensureWarehouseTables() {
            return new Promise((r, j) => {
              db.run(
                `CREATE TABLE IF NOT EXISTS warehouses (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL UNIQUE,
                  description TEXT,
                  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                )`,
                (e) => {
                  if (e) { j(e); return; }
                  db.run(
                    `CREATE TABLE IF NOT EXISTS user_warehouses (
                      user_id INTEGER NOT NULL,
                      warehouse_id INTEGER NOT NULL,
                      PRIMARY KEY (user_id, warehouse_id),
                      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
                    )`,
                    (e2) => {
                      if (e2) { j(e2); return; }
                      console.log("✅ Warehouses tables ready");
                      ensureDefaultWarehouse().then(r).catch(j);
                    }
                  );
                }
              );
            });
          }

          function ensureDefaultWarehouse() {
            return new Promise((r, j) => {
              // Default warehouse is always id=1 and cannot be deleted
              db.run(
                "INSERT OR IGNORE INTO warehouses (id, name, description) VALUES (1, 'default', '預設倉庫（不可刪除）')",
                (e0) => {
                  if (e0) { j(e0); return; }
                  db.get("SELECT id FROM warehouses WHERE id = 1", (e2, row) => {
                    if (e2) { j(e2); return; }
                    const defaultId = row.id;
                    // Add warehouse_id column to products if missing
                    db.all("PRAGMA table_info(products)", (e3, cols) => {
                      if (e3) { j(e3); return; }
                      const hasWarehouseId = cols.some(c => c.name === "warehouse_id");
                      const addCol = hasWarehouseId
                        ? Promise.resolve()
                        : new Promise((res, rej) => {
                            db.run("ALTER TABLE products ADD COLUMN warehouse_id INTEGER", (e) => {
                              if (e) rej(e);
                              else { console.log("✅ Added warehouse_id to products"); res(); }
                            });
                          });
                      addCol
                        .then(() => new Promise((res, rej) => {
                          db.run(
                            `UPDATE products SET warehouse_id = ? WHERE warehouse_id IS NULL`,
                            [defaultId],
                            (e) => { if (e) rej(e); else res(); }
                          );
                        }))
                        .then(() => ensureWarehouseIdOnTables(defaultId))
                        .then(() => backfillWarehouseIds(defaultId))
                          .then(() => ensureTransactionsQuantityType())
                        .then(() => fixProductsUniqueConstraint())
                        .then(() => rebuildLegacyAuditLogs())
                        .then(() => { console.log("✅ Default warehouse ready"); r(); })
                        .catch(j);
                    });
                  });
                });
            });
          }

          // Fix: old databases have UNIQUE(sku) instead of UNIQUE(sku, warehouse_id).
          // SQLite can't ALTER a constraint, so we recreate the table if needed.
          function fixProductsUniqueConstraint() {
            return new Promise((r, j) => {
              db.all("PRAGMA index_list(products)", (e, indexes) => {
                if (e) { j(e); return; }
                // Look for a unique index on exactly one column (the old UNIQUE(sku))
                const oldUniqueIdx = indexes.find(idx => idx.unique === 1 && idx.origin === 'u');
                if (!oldUniqueIdx) { r(); return; }

                // Check if that index is on sku alone (not sku+warehouse_id)
                db.all(`PRAGMA index_info(${oldUniqueIdx.name})`, (e2, cols) => {
                  if (e2) { j(e2); return; }
                  const colNames = cols.map(c => c.name);
                  if (colNames.length !== 1 || colNames[0] !== 'sku') { r(); return; }

                  console.log("⚠️  Detected old UNIQUE(sku) constraint — migrating to UNIQUE(sku, warehouse_id)...");
                  db.run("PRAGMA foreign_keys = OFF", (eFk) => {
                    if (eFk) { j(eFk); return; }
                    doMigration();
                  });

                  function doMigration() {
                    const fail = (err) => {
                      db.run("ROLLBACK", () => {
                        db.run("PRAGMA foreign_keys = ON", () => j(err));
                      });
                    };
                    db.run("BEGIN TRANSACTION", (e3) => {
                      if (e3) { db.run("PRAGMA foreign_keys = ON"); j(e3); return; }
                      db.run(`
                        CREATE TABLE products_new (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          warehouse_id INTEGER,
                          type TEXT NOT NULL,
                          sku TEXT NOT NULL,
                          name TEXT NOT NULL,
                          model TEXT,
                          accountable_quantity INTEGER NOT NULL DEFAULT 0,
                          non_accountable_quantity INTEGER NOT NULL DEFAULT 0,
                          min_stock INTEGER NOT NULL DEFAULT 0,
                          track_serial INTEGER NOT NULL DEFAULT 0,
                          is_deleted BOOLEAN NOT NULL DEFAULT 0,
                          created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                          updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                          UNIQUE(sku, warehouse_id)
                        )
                      `, (e4) => {
                        if (e4) { fail(e4); return; }
                        db.run("INSERT INTO products_new SELECT id, warehouse_id, type, sku, name, model, accountable_quantity, non_accountable_quantity, min_stock, track_serial, is_deleted, created_at, updated_at FROM products", (e5) => {
                          if (e5) { fail(e5); return; }
                          db.run("DROP TABLE products", (e6) => {
                            if (e6) { fail(e6); return; }
                            db.run("ALTER TABLE products_new RENAME TO products", (e7) => {
                              if (e7) { fail(e7); return; }
                              db.run("COMMIT", (e8) => {
                                if (e8) { fail(e8); return; }
                                db.run("PRAGMA foreign_keys = ON", () => {
                                  console.log("✅ Migrated products to UNIQUE(sku, warehouse_id)");
                                  r();
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  } // doMigration
                });
              });
            });
          }

          // audit_logs from database/migrations/001 rejects every action except CREATE/UPDATE/DELETE
          // and NULL user_id/resource_id, so login and admin events were silently dropped.
          // SQLite can't drop a constraint: rebuild the table, keeping every row and id.
          function rebuildLegacyAuditLogs() {
            return new Promise((r, j) => {
              db.get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audit_logs'", (e, row) => {
                if (e) { j(e); return; }
                db.all("PRAGMA table_info(audit_logs)", (e2, cols) => {
                  if (e2) { j(e2); return; }
                  const strictCols = cols.some(c => ["user_id", "resource_id"].includes(c.name) && c.notnull);
                  if (!/CHECK\s*\(\s*action/i.test(row.sql) && !strictCols) { r(); return; }

                  console.log("⚠️  Detected legacy audit_logs constraints — rebuilding table...");
                  const columns = "id, user_id, action, resource_type, resource_id, warehouse_id, event_category, metadata, ip_address, timestamp";
                  db.exec(`
                    BEGIN TRANSACTION;
                    CREATE TABLE audit_logs_new (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER,
                      action TEXT NOT NULL,
                      resource_type TEXT NOT NULL,
                      resource_id INTEGER,
                      warehouse_id INTEGER,
                      event_category TEXT NOT NULL DEFAULT 'transaction',
                      metadata TEXT,
                      ip_address TEXT,
                      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                    INSERT INTO audit_logs_new (${columns}) SELECT ${columns} FROM audit_logs;
                    DROP TABLE audit_logs;
                    ALTER TABLE audit_logs_new RENAME TO audit_logs;
                    COMMIT;
                  `, (e3) => {
                    if (e3) { db.run("ROLLBACK", () => j(e3)); return; }
                    console.log("✅ Rebuilt audit_logs without legacy constraints");
                    r();
                  });
                });
              });
            });
          }

          function ensureWarehouseIdOnTables(defaultId) {
            const tables = ["transactions", "batches", "shipments", "product_units"];
            return tables.reduce((chain, table) => {
              return chain.then(() => new Promise((r, j) => {
                db.all(`PRAGMA table_info(${table})`, (e, cols) => {
                  if (e) { j(e); return; }
                  const has = cols.some(c => c.name === "warehouse_id");
                  if (has) { r(); return; }
                  db.run(`ALTER TABLE ${table} ADD COLUMN warehouse_id INTEGER`, (e2) => {
                    if (e2) { j(e2); return; }
                    console.log(`✅ Added warehouse_id to ${table}`);
                    db.run(`UPDATE ${table} SET warehouse_id = ? WHERE warehouse_id IS NULL`, [defaultId], (e3) => {
                      if (e3) j(e3); else r();
                    });
                  });
                });
              }));
            }, Promise.resolve());
          }

          // Rows written before every path stamped warehouse_id: take it from the product
          // (transactions, units) or from the products of their transactions (batches, shipments).
          // Batches/shipments without any transaction fall back to the default warehouse.
          function backfillWarehouseIds(defaultId) {
            const statements = [
              `UPDATE transactions SET warehouse_id = (SELECT p.warehouse_id FROM products p WHERE p.id = transactions.product_id)
               WHERE warehouse_id IS NULL`,
              `UPDATE product_units SET warehouse_id = (SELECT p.warehouse_id FROM products p WHERE p.id = product_units.product_id)
               WHERE warehouse_id IS NULL`,
              `UPDATE batches SET warehouse_id = (
                 SELECT p.warehouse_id FROM transactions t JOIN products p ON p.id = t.product_id
                 WHERE t.batch_id = batches.id LIMIT 1)
               WHERE warehouse_id IS NULL`,
              `UPDATE shipments SET warehouse_id = (
                 SELECT p.warehouse_id FROM shipment_transactions st
                 JOIN transactions t ON t.id = st.transaction_id JOIN products p ON p.id = t.product_id
                 WHERE st.shipment_id = shipments.id LIMIT 1)
               WHERE warehouse_id IS NULL`,
              `UPDATE batches SET warehouse_id = ${Number(defaultId)} WHERE warehouse_id IS NULL`,
              `UPDATE shipments SET warehouse_id = ${Number(defaultId)} WHERE warehouse_id IS NULL`,
            ];
            return statements.reduce((chain, sql) => chain.then(() => new Promise((r, j) => {
              db.run(sql, (e) => (e ? j(e) : r()));
            })), Promise.resolve());
          }

            function ensureTransactionsQuantityType() {
              return new Promise((r, j) => {
                db.all("PRAGMA table_info(transactions)", (e, cols) => {
                  if (e) { j(e); return; }
                  const has = cols.some(c => c.name === "quantity_type");
                  if (has) { r(); return; }
                  db.run("ALTER TABLE transactions ADD COLUMN quantity_type TEXT DEFAULT 'accountable'", (e2) => {
                    if (e2) { j(e2); return; }
                    console.log("✅ Added quantity_type to transactions");
                    // Backfill existing rows from remarks prefix (old format)
                    db.run(
                      "UPDATE transactions SET quantity_type = 'non_accountable' WHERE remarks LIKE '[無帳]%' AND (quantity_type IS NULL OR quantity_type = '')",
                      (e3) => {
                        if (e3) { j(e3); return; }
                        db.run(
                          "UPDATE transactions SET quantity_type = 'accountable' WHERE (quantity_type IS NULL OR quantity_type = '')",
                          (e4) => {
                            if (e4) j(e4); else { console.log("✅ Backfilled transactions.quantity_type"); r(); }
                          }
                        );
                      }
                    );
                  });
                });
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
        // Default admin comes only from ADMIN_USERNAME / ADMIN_PASSWORD; skip when either is unset
        const username = process.env.ADMIN_USERNAME;
        const password = process.env.ADMIN_PASSWORD;
        if (!username || !password) {
          console.log("ℹ️  ADMIN_USERNAME / ADMIN_PASSWORD not set, skipping default admin");
          resolve(db);
          return;
        }

        // Check if default user already exists
        db.all("SELECT id FROM users WHERE username = ? LIMIT 1", [username], (checkErr, rows) => {
          if (checkErr) {
            console.error("❌ Failed to check for default user:", checkErr.message);
            resolve(db);
            return;
          }

          if (rows && rows.length > 0) {
            console.log(`✅ Default admin '${username}' already exists`);
            resolve(db);
            return;
          }

          // Create default user with bcrypt
          const bcrypt = require("bcrypt");
          bcrypt.hash(password, 10, (hashErr, passwordHash) => {
            if (hashErr) {
              console.error("❌ Failed to hash password:", hashErr.message);
              resolve(db);
              return;
            }

            db.run(
              "INSERT INTO users (username, password_hash, role, provider) VALUES (?, ?, 'admin', 'local')",
              [username, passwordHash],
              function (insertErr) {
                if (insertErr) {
                  console.error("❌ Failed to create default user:", insertErr.message);
                } else {
                  console.log(`✅ Default admin '${username}' created`);
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
function rawRun(sql, params = []) {
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

function rawGet(sql, params = []) {
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

function rawAll(sql, params = []) {
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

// All requests share one connection, so an open transaction would absorb any query
// another request issues. Plain queries wait until the open transaction finishes;
// queries made from inside the transaction's async context (txContext) go straight through.
const txContext = new AsyncLocalStorage();
const txHandle = { run: rawRun, get: rawGet, all: rawAll };
let openTransaction = null;

function gated(fn) {
  return async (sql, params) => {
    if (!txContext.getStore()) {
      while (openTransaction) await openTransaction.catch(() => {});
    }
    return fn(sql, params);
  };
}

const run = gated(rawRun);
const get = gated(rawGet);
const all = gated(rawAll);

/**
 * Run `fn(tx)` inside BEGIN/COMMIT; ROLLBACK and rethrow if it throws.
 * Transactions run one at a time. Calling it from inside a transaction joins that one.
 */
async function transaction(fn) {
  if (txContext.getStore()) return fn(txHandle);

  // No await between the last check and claiming openTransaction, or two callers could both start.
  while (openTransaction) await openTransaction.catch(() => {});
  const work = txContext.run(true, async () => {
    await rawRun("BEGIN TRANSACTION");
    try {
      const result = await fn(txHandle);
      await rawRun("COMMIT");
      return result;
    } catch (error) {
      await rawRun("ROLLBACK").catch(() => {});
      throw error;
    }
  });
  openTransaction = work;
  try {
    return await work;
  } finally {
    if (openTransaction === work) openTransaction = null;
  }
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
  transaction,
  closeDatabase,
};
