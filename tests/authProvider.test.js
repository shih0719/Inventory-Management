const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/auth/provider", () => {
  it("是 public 端點，不需要登入", async () => {
    const res = await request(app).get("/api/auth/provider");
    expect(res.status).toBe(200);
  });

  it("預設回傳 provider: local", async () => {
    const res = await request(app).get("/api/auth/provider");
    expect(res.body.provider).toBe("local");
  });

  it("切換為 microsoft 後回傳 provider: microsoft", async () => {
    process.env.AUTH_PROVIDER = "microsoft";
    const res = await request(app).get("/api/auth/provider");
    expect(res.body.provider).toBe("microsoft");
    delete process.env.AUTH_PROVIDER;
  });
});
