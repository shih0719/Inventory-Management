const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRE = "24h";

/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Login user and return JWT token
 */
async function login(username, password) {
  // Find user by username
  const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);

  if (!user) {
    throw new Error("Invalid username or password");
  }

  // Compare password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error("Invalid username or password");
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
    },
  };
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Create a new user (for seeding)
 */
async function createUser(username, password) {
  const passwordHash = await hashPassword(password);

  const result = await db.run(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    [username, passwordHash]
  );

  return {
    id: result.id,
    username: username,
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) {
    throw new Error("User not found");
  }

  const isValid = await comparePassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters");
  }

  const newHash = await hashPassword(newPassword);
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);
}

module.exports = {
  login,
  verifyToken,
  hashPassword,
  comparePassword,
  createUser,
  changePassword,
};
