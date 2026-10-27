// db.transaction(): one shared sqlite connection, so transactions must not interleave
// with each other or with plain queries from other requests (tech-debt B1 / C3).
const { setupTestDb, teardownTestDb } = require("./helpers/db");

let db;

beforeAll(async () => {
  await setupTestDb();
  db = require("../src/config/database");
  await db.run("CREATE TABLE tx_probe (id INTEGER PRIMARY KEY, v INTEGER)");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await db.run("DELETE FROM tx_probe");
});

const tick = () => new Promise((r) => setTimeout(r, 5));

test("commits all writes when the callback resolves", async () => {
  const result = await db.transaction(async (tx) => {
    await tx.run("INSERT INTO tx_probe (v) VALUES (1)");
    await tx.run("INSERT INTO tx_probe (v) VALUES (2)");
    return "done";
  });
  expect(result).toBe("done");
  expect((await db.get("SELECT COUNT(*) AS n FROM tx_probe")).n).toBe(2);
});

test("rolls back every write when the callback throws", async () => {
  await expect(
    db.transaction(async (tx) => {
      await tx.run("INSERT INTO tx_probe (v) VALUES (1)");
      throw new Error("boom");
    })
  ).rejects.toThrow("boom");
  expect((await db.get("SELECT COUNT(*) AS n FROM tx_probe")).n).toBe(0);
});

test("a plain write from another request is not swept into an open transaction", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });

  const failing = db.transaction(async (tx) => {
    await tx.run("INSERT INTO tx_probe (v) VALUES (1)");
    await gate;
    throw new Error("rollback me");
  });
  await tick();

  // Another request writes while the transaction is open; it must wait, not join it.
  const outside = db.run("INSERT INTO tx_probe (v) VALUES (99)");
  await tick();
  release();

  await expect(failing).rejects.toThrow("rollback me");
  await outside;
  const rows = await db.all("SELECT v FROM tx_probe");
  expect(rows).toEqual([{ v: 99 }]);
});

test("concurrent transactions run one after another", async () => {
  const order = [];
  const t = (name) =>
    db.transaction(async (tx) => {
      order.push(`${name}:start`);
      await tick();
      await tx.run("INSERT INTO tx_probe (v) VALUES (1)");
      order.push(`${name}:end`);
    });
  await Promise.all([t("a"), t("b")]);
  expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
});

test("plain db calls made inside the callback join the transaction instead of deadlocking", async () => {
  await expect(
    db.transaction(async () => {
      await db.run("INSERT INTO tx_probe (v) VALUES (1)");
      expect((await db.get("SELECT COUNT(*) AS n FROM tx_probe")).n).toBe(1);
      throw new Error("undo");
    })
  ).rejects.toThrow("undo");
  expect((await db.get("SELECT COUNT(*) AS n FROM tx_probe")).n).toBe(0);
});

test("a nested db.transaction joins the outer one", async () => {
  await expect(
    db.transaction(async () => {
      await db.transaction(async (inner) => {
        await inner.run("INSERT INTO tx_probe (v) VALUES (1)");
      });
      throw new Error("outer fails");
    })
  ).rejects.toThrow("outer fails");
  expect((await db.get("SELECT COUNT(*) AS n FROM tx_probe")).n).toBe(0);
});
