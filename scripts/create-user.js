#!/usr/bin/env node
const bcrypt = require('bcrypt');
const db = require('./src/config/database');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node create-user.js <username> <password>');
  process.exit(1);
}

async function createUser() {
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash]
    );
    console.log(`✅ User created: ${username} (ID: ${result.id})`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

createUser();
