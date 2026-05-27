#!/usr/bin/env node
const bcrypt = require('bcrypt');
const { initDatabase, run, get, closeDatabase } = require('../src/config/database');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node create-user.js <username> <password>');
  process.exit(1);
}

async function createUser() {
  try {
    // Initialize database
    await initDatabase();

    // Check if user already exists
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      console.error(`❌ Error: User "${username}" already exists (ID: ${existing.id})`);
      await closeDatabase();
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash]
    );
    console.log(`✅ User created: ${username} (ID: ${result.id})`);

    // Close database connection
    await closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    await closeDatabase().catch(() => {});
    process.exit(1);
  }
}

createUser();
