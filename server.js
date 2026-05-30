require("dotenv").config();
const { initDatabase } = require("./src/config/database");
const logger = require("./src/config/logger");
const { createApp } = require("./src/app");

const app = createApp();
const PORT = process.env.PORT || 3030;

// Import backup service
const { startBackupDaemon } = require("./src/services/backupService");

// Initialize database and start server
initDatabase()
  .then(() => {
    // 启动备份守护程序
    startBackupDaemon();

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`, { service: 'SERVER' });
      logger.info(`API endpoints: http://localhost:${PORT}/api`, { service: 'SERVER' });
      logger.info(`Frontend: http://localhost:${PORT}`, { service: 'SERVER' });
      logger.info(`Version check: Manual only (visit /updates.html)`, { service: 'SERVER' });
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 API endpoints: http://localhost:${PORT}/api`);
      console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
      console.log(`🔄 Version check: Manual only (visit /updates.html)\n`);
    });
  })
  .catch((err) => {
    logger.error(`Failed to start server: ${err.message}`, { service: 'SERVER' });
    console.error("Failed to start server:", err);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down gracefully...", { service: 'SERVER' });
  console.log("\n⚠️  Shutting down gracefully...");
  const { closeDatabase } = require("./src/config/database");
  closeDatabase().then(() => {
    process.exit(0);
  });
});
