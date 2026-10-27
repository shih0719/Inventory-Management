const os = require("os");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3");

// B6：schema.sql 是新資料庫的完整 schema；啟動時的 migration 只負責把舊資料庫補到同一個形狀
const SCHEMA = fs.readFileSync(path.join(__dirname, "../database/schema.sql"), "utf8");
// database/schema.sql before B6 — the shape existing databases were created from
const LEGACY_SCHEMA = fs.readFileSync(path.join(__dirname, "fixtures/legacy-schema.sql"), "utf8");
// audit_logs as created by database/migrations/001 — what the production database has
const LEGACY_AUDIT_LOGS = `
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')),
    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL,
    warehouse_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, event_category TEXT NOT NULL DEFAULT 'transaction', metadata TEXT, ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, warehouse_id, timestamp, metadata)
  VALUES (1, 'UPDATE', 'product', 7, 2, '2026-05-01 10:00:00', '{"a":1}');
`;
// Unused tables that old databases still carry; startup leaves them alone
const IGNORED = /^webhook_/;

const query = (conn, sql) => new Promise((resolve, reject) => conn.all(sql, (e, rows) => (e ? reject(e) : resolve(rows))));

/** Tables (with columns), indexes and triggers, sorted so creation order doesn't matter. */
async function snapshot(conn) {
  const objects = await query(conn, "SELECT type, name, tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name");
  const result = {};
  for (const { type, name, tbl_name: table } of objects) {
    if (IGNORED.test(table)) continue;
    if (type !== "table") {
      result[`${type} ${name}`] = table;
      continue;
    }
    const cols = await query(conn, `PRAGMA table_info(${name})`);
    result[`table ${name}`] = cols
      .map((c) => `${c.name} ${c.type} notnull=${c.notnull} default=${c.dflt_value} pk=${c.pk}`)
      .sort();
  }
  return result;
}

function openRaw(file) {
  return new Promise((resolve, reject) => {
    const conn = new sqlite3.Database(file, (e) => (e ? reject(e) : resolve(conn)));
  });
}

const exec = (conn, sql) => new Promise((resolve, reject) => conn.exec(sql, (e) => (e ? reject(e) : resolve())));
const close = (conn) => new Promise((resolve) => conn.close(() => resolve()));

/** Run the app's startup (schema + migrations + seeds) on `file` and snapshot the result; `after(db)` runs before closing. */
async function bootAndSnapshot(file, after = async () => {}) {
  const saved = process.env.DB_PATH;
  process.env.DB_PATH = file;
  let mod;
  jest.isolateModules(() => { mod = require("../src/config/database"); });
  try {
    await mod.initDatabase();
    const conn = await openRaw(file);
    const snap = await snapshot(conn);
    await close(conn);
    await after(mod);
    return snap;
  } finally {
    await mod.closeDatabase();
    process.env.DB_PATH = saved;
  }
}

const tempDb = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "inv-schema-")), name);

describe("B6 — schema.sql 與啟動 migration 一致", () => {
  let fromSchema;

  beforeAll(async () => {
    const conn = await openRaw(":memory:");
    await exec(conn, SCHEMA);
    fromSchema = await snapshot(conn);
    await close(conn);
  });

  test("新資料庫：啟動 migration 不需要再補任何欄位、索引或 trigger", async () => {
    expect(await bootAndSnapshot(tempDb("fresh.db"))).toEqual(fromSchema);
  });

  test("舊資料庫：啟動後與新資料庫的 schema 相同", async () => {
    const file = tempDb("legacy.db");
    const conn = await openRaw(file);
    await exec(conn, LEGACY_SCHEMA);
    await close(conn);
    expect(await bootAndSnapshot(file)).toEqual(fromSchema);
  });

  test("001 版的 audit_logs 重建：保留原有紀錄，可以寫入 LOGIN 等 action 與 null user", async () => {
    const file = tempDb("legacy-audit.db");
    const conn = await openRaw(file);
    await exec(conn, LEGACY_AUDIT_LOGS + LEGACY_SCHEMA);
    await close(conn);

    const snap = await bootAndSnapshot(file, async (db) => {
      expect(await db.all("SELECT id, user_id, action, resource_type, resource_id, warehouse_id, timestamp, metadata FROM audit_logs")).toEqual([
        { id: 1, user_id: 1, action: "UPDATE", resource_type: "product", resource_id: 7, warehouse_id: 2, timestamp: "2026-05-01 10:00:00", metadata: '{"a":1}' },
      ]);
      await db.run("INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES (NULL, 'LOGIN_FAILED', 'user', NULL)");
      const next = await db.run("INSERT INTO audit_logs (user_id, action, resource_type) VALUES (1, 'LOGIN', 'user')");
      expect(next.id).toBe(3);
    });
    expect(snap).toEqual(fromSchema);
  });

  test("schema.sql 不建立沒有程式使用的 webhook 表", () => {
    expect(SCHEMA).not.toMatch(/webhook_/);
  });
});
