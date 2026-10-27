const os = require("os");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3");

// B6：schema.sql 是新資料庫的完整 schema；啟動時的 migration 只負責把舊資料庫補到同一個形狀
const SCHEMA = fs.readFileSync(path.join(__dirname, "../database/schema.sql"), "utf8");
// database/schema.sql before B6 — the shape existing databases were created from
const LEGACY_SCHEMA = fs.readFileSync(path.join(__dirname, "fixtures/legacy-schema.sql"), "utf8");
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

/** Run the app's startup (schema + migrations + seeds) on `file` and snapshot the result. */
async function bootAndSnapshot(file) {
  const saved = process.env.DB_PATH;
  process.env.DB_PATH = file;
  let mod;
  jest.isolateModules(() => { mod = require("../src/config/database"); });
  try {
    await mod.initDatabase();
    const conn = await openRaw(file);
    const snap = await snapshot(conn);
    await close(conn);
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

  test("schema.sql 不建立沒有程式使用的 webhook 表", () => {
    expect(SCHEMA).not.toMatch(/webhook_/);
  });
});
