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

      // Execute seeds
      const seeds = fs.readFileSync(SEEDS_PATH, "utf8");
      db.exec(seeds, (err) => {
        if (err) {
          console.error("❌ Seeds execution failed:", err.message);
          reject(err);
          return;
        }
        console.log("✅ Seed data loaded");
        resolve(db);
      });
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
