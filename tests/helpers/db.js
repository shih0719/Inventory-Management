const { initDatabase, closeDatabase } = require("../../src/config/database");

async function setupTestDb() {
  process.env.DB_PATH = ":memory:";
  await initDatabase();
}

async function teardownTestDb() {
  await closeDatabase();
}

module.exports = { setupTestDb, teardownTestDb };
