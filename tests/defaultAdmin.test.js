const { initDatabase, closeDatabase, all, get } = require("../src/config/database");
const bcrypt = require("bcrypt");

// B5 — 預設 admin 只能來自 ADMIN_USERNAME / ADMIN_PASSWORD，沒設定就不建立
describe("B5 — 預設 admin 帳號", () => {
  const saved = { u: process.env.ADMIN_USERNAME, p: process.env.ADMIN_PASSWORD };

  afterEach(async () => {
    await closeDatabase();
    process.env.ADMIN_USERNAME = saved.u;
    process.env.ADMIN_PASSWORD = saved.p;
  });

  test("沒設定環境變數時不建立任何使用者", async () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    await initDatabase();
    expect(await all("SELECT id FROM users")).toEqual([]);
  });

  test("只設定其中一個時不建立", async () => {
    process.env.ADMIN_USERNAME = "boss";
    delete process.env.ADMIN_PASSWORD;
    await initDatabase();
    expect(await all("SELECT id FROM users")).toEqual([]);
  });

  test("重新啟動不會把名為 eric 的 view 帳號升成 admin", async () => {
    const os = require("os");
    const path = require("path");
    const fs = require("fs");
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "inv-")), "restart.db");
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    const savedPath = process.env.DB_PATH;
    process.env.DB_PATH = file;
    // A fresh module instance per "process start", both on the same file
    const boot = () => {
      let mod;
      jest.isolateModules(() => { mod = require("../src/config/database"); });
      return mod;
    };
    try {
      const first = boot();
      await first.initDatabase();
      await first.run("INSERT INTO users (username, password_hash, role, provider) VALUES ('eric', 'x', 'view', 'local')");
      await first.closeDatabase();

      const second = boot();
      await second.initDatabase();
      expect((await second.get("SELECT role FROM users WHERE username = 'eric'")).role).toBe("view");
      await second.closeDatabase();
    } finally {
      process.env.DB_PATH = savedPath;
      await initDatabase(); // afterEach closes the shared module's connection
    }
  });

  test("兩個都設定時以該帳密建立 admin", async () => {
    process.env.ADMIN_USERNAME = "boss";
    process.env.ADMIN_PASSWORD = "s3cret!";
    await initDatabase();
    const user = await get("SELECT username, password_hash, role FROM users");
    expect(user.username).toBe("boss");
    expect(user.role).toBe("admin");
    expect(await bcrypt.compare("s3cret!", user.password_hash)).toBe(true);
  });
});
