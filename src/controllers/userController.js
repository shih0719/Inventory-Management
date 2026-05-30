const userService = require("../services/userService");

async function getAll(req, res) {
  try {
    const data = await userService.listUsers();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function create(req, res) {
  try {
    const { username, password, role = "view", warehouse_ids = [] } = req.body;
    const data = await userService.createUser(username, password, role, warehouse_ids);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { role, warehouse_ids = [] } = req.body;
    const data = await userService.updateUser(id, role, warehouse_ids);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    await userService.deleteUser(id, req.user.id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

module.exports = { getAll, create, update, remove };
