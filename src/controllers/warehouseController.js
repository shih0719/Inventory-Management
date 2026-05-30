const warehouseService = require("../services/warehouseService");

async function getAll(req, res) {
  try {
    const data = await warehouseService.listWarehouses();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function create(req, res) {
  try {
    const { name, description } = req.body;
    const data = await warehouseService.createWarehouse(name, description);
    res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const data = await warehouseService.updateWarehouse(id, name, description);
    res.status(200).json({ success: true, data });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    await warehouseService.deleteWarehouse(id);
    res.status(200).json({ success: true });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

module.exports = { getAll, create, update, remove };
