process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";
process.env.ADMIN_USERNAME = "eric";
process.env.ADMIN_PASSWORD = "password";
// Defined but empty, so dotenv cannot fill them from a real .env and tests never notify anyone.
process.env.STOCK_WEBHOOK_URL = "";
process.env.LINE_CHANNEL_ACCESS_TOKEN = "";
process.env.LINE_TO = "";
