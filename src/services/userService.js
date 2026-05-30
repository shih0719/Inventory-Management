const bcrypt = require("bcrypt");
const db = require("../config/database");

async function listUsers() {
  const users = await db.all(
    "SELECT id, username, role, provider, email, created_at FROM users ORDER BY created_at"
  );
  const rows = await db.all("SELECT user_id, warehouse_id FROM user_warehouses");
  const warehouseMap = {};
  for (const r of rows) {
    if (!warehouseMap[r.user_id]) warehouseMap[r.user_id] = [];
    warehouseMap[r.user_id].push(r.warehouse_id);
  }
  return users.map((u) => ({ ...u, warehouses: warehouseMap[u.id] || [] }));
}

async function createUser(username, password, role, warehouseIds = []) {
  if (!username || !password) {
    throw Object.assign(new Error("username and password are required"), { status: 400 });
  }
  if (!["admin", "manager", "view"].includes(role)) {
    throw Object.assign(new Error("Invalid role"), { status: 400 });
  }
  await validateWarehouseIds(warehouseIds);

  const hash = await bcrypt.hash(password, 10);
  let result;
  try {
    result = await db.run(
      "INSERT INTO users (username, password_hash, role, provider) VALUES (?, ?, ?, 'local')",
      [username, hash, role]
    );
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      throw Object.assign(new Error(`Username "${username}" already exists`), { status: 409 });
    }
    throw err;
  }

  const userId = result.id;

  // If no warehouses specified, auto-assign Default warehouse
  let ids = warehouseIds;
  if (!ids || ids.length === 0) {
    const defaultWh = await db.get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
    if (defaultWh) ids = [defaultWh.id];
  }
  await assignWarehouses(userId, ids);

  return getUserById(userId);
}

async function updateUser(id, role, warehouseIds = []) {
  const existing = await db.get("SELECT id FROM users WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("User not found"), { status: 404 });
  }
  if (!["admin", "manager", "view"].includes(role)) {
    throw Object.assign(new Error("Invalid role"), { status: 400 });
  }
  await validateWarehouseIds(warehouseIds);

  await db.run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  await db.run("DELETE FROM user_warehouses WHERE user_id = ?", [id]);
  await assignWarehouses(id, warehouseIds);

  return getUserById(id);
}

async function deleteUser(id, requestingUserId) {
  if (parseInt(id) === parseInt(requestingUserId)) {
    throw Object.assign(new Error("Cannot delete your own account"), { status: 400 });
  }
  const existing = await db.get("SELECT id FROM users WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("User not found"), { status: 404 });
  }
  await db.run("DELETE FROM user_warehouses WHERE user_id = ?", [id]);
  await db.run("DELETE FROM users WHERE id = ?", [id]);
}

async function validateWarehouseIds(ids) {
  if (!ids || ids.length === 0) return;
  for (const wid of ids) {
    const wh = await db.get("SELECT id FROM warehouses WHERE id = ?", [wid]);
    if (!wh) {
      throw Object.assign(new Error(`Warehouse id ${wid} does not exist`), { status: 400 });
    }
  }
}

async function assignWarehouses(userId, ids) {
  for (const wid of ids) {
    await db.run(
      "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
      [userId, wid]
    );
  }
}

async function getUserById(id) {
  const user = await db.get(
    "SELECT id, username, role, provider, email, created_at FROM users WHERE id = ?",
    [id]
  );
  const rows = await db.all("SELECT warehouse_id FROM user_warehouses WHERE user_id = ?", [id]);
  return { ...user, warehouses: rows.map((r) => r.warehouse_id) };
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
