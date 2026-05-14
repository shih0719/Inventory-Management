require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const os = require("os");
const { initDatabase } = require("./src/config/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Import routes
const productsRoutes = require("./src/routes/products");
const transactionsRoutes = require("./src/routes/transactions");
const tagsRoutes = require("./src/routes/tags");
const csvRoutes = require("./src/routes/csv");
const batchesRoutes = require("./src/routes/batches");
const locationsRoutes = require("./src/routes/locations");
const systemRoutes = require("./src/routes/system");
const webhooksRoutes = require("./src/routes/webhooks");
const productUnitsRoutes = require("./src/routes/productUnits");
const updatesRoutes = require("./src/routes/updates");

// Import update service
const updateService = require("./src/services/updateService");

// Import backup service
const { startBackupDaemon } = require("./src/services/backupService");

// API Routes
app.use("/api/products", productsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/csv", csvRoutes);
app.use("/api/batches", batchesRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/product-units", productUnitsRoutes);
app.use("/api/updates", updatesRoutes);


// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Server info endpoint (for IP detection)
app.get("/api/info", (req, res) => {
  const interfaces = os.networkInterfaces();
  let ip = "localhost";
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        ip = iface.address;
        break;
      }
    }
    if (ip !== "localhost") break;
  }
  
  res.json({
    ip,
    port: PORT,
    url: `http://${ip}:${PORT}`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: "Not Found", status: 404 } });
});

// Initialize database and start server
initDatabase()
  .then(() => {
    // 啟動備份守護程序
    startBackupDaemon();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 API endpoints: http://localhost:${PORT}/api`);
      console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
      console.log(`🔄 Version check: Manual only (visit /updates.html)\n`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⚠️  Shutting down gracefully...");
  const { closeDatabase } = require("./src/config/database");
  closeDatabase().then(() => {
    process.exit(0);
  });
});
