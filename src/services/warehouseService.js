const db = require("../config/database");

async function listWarehouses() {
  return db.all("SELECT id, name, description, created_at FROM warehouses ORDER BY name");
}

async function createWarehouse(name, description) {
  if (!name || !name.trim()) {
    throw Object.assign(new Error("name is required"), { status: 400 });
  }
  try {
    const result = await db.run(
      "INSERT INTO warehouses (name, description) VALUES (?, ?)",
      [name.trim(), description || null]
    );
    return db.get("SELECT id, name, description, created_at FROM warehouses WHERE id = ?", [result.id]);
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      throw Object.assign(new Error(`Warehouse name "${name}" already exists`), { status: 409 });
    }
    throw err;
  }
}

async function updateWarehouse(id, name, description) {
  const existing = await db.get("SELECT id FROM warehouses WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("Warehouse not found"), { status: 404 });
  }
  try {
    await db.run(
      "UPDATE warehouses SET name = ?, description = ? WHERE id = ?",
      [name.trim(), description !== undefined ? description : null, id]
    );
    return db.get("SELECT id, name, description, created_at FROM warehouses WHERE id = ?", [id]);
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      throw Object.assign(new Error(`Warehouse name "${name}" already exists`), { status: 409 });
    }
    throw err;
  }
}

async function deleteWarehouse(id) {
  if (Number(id) === 1) {
    throw Object.assign(new Error("Default warehouse cannot be deleted"), { status: 403 });
  }
  const existing = await db.get("SELECT id FROM warehouses WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("Warehouse not found"), { status: 404 });
  }
  await db.run("DELETE FROM warehouses WHERE id = ?", [id]);
}

module.exports = { listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse };
