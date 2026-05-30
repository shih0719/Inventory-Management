const express = require("express");
const cors = require("cors");
const path = require("path");
const os = require("os");
const logger = require("./config/logger");
const { verifyAuth, requireWarehouse } = require("./middleware/authMiddleware");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "../public")));

  // ── 公開路由（無需 auth）────────────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  app.get("/api/info", (req, res) => {
    const interfaces = os.networkInterfaces();
    let ip = "localhost";
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          ip = iface.address;
          break;
        }
      }
      if (ip !== "localhost") break;
    }
    res.json({ ip, port: process.env.PORT || 3030, url: `http://${ip}:${process.env.PORT || 3030}` });
  });

  // ── 不需要倉庫 context 的路由 ────────────────────────────────────────────
  app.use("/api/auth",       require("./routes/auth"));
  app.use("/api/warehouses", verifyAuth, require("./routes/warehouses"));
  app.use("/api/users",      verifyAuth, require("./routes/users"));

  // ── 需要倉庫 context 的路由 ──────────────────────────────────────────────
  // 新增路由只要在這裡掛一行，verifyAuth + requireWarehouse 自動套用
  const warehouseRouter = express.Router();
  warehouseRouter.use(verifyAuth);
  warehouseRouter.use(requireWarehouse);
  warehouseRouter.use("/products",      require("./routes/products"));
  warehouseRouter.use("/transactions",  require("./routes/transactions"));
  warehouseRouter.use("/batches",       require("./routes/batches"));
  warehouseRouter.use("/shipments",     require("./routes/shipments"));
  warehouseRouter.use("/tags",          require("./routes/tags"));
  warehouseRouter.use("/csv",           require("./routes/csv"));
  warehouseRouter.use("/product-units", require("./routes/productUnits"));
  warehouseRouter.use("/audit-logs",    require("./routes/audit"));
  warehouseRouter.use("/reports",       require("./routes/reports"));
  app.use("/api", warehouseRouter);

  app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`, { service: "SERVER" });
    res.status(err.status || 500).json({
      error: { message: err.message || "Internal Server Error", status: err.status || 500 },
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: { message: "Not Found", status: 404 } });
  });

  return app;
}

module.exports = { createApp };
