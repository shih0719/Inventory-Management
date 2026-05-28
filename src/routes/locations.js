const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middleware/authMiddleware');
const locationsController = require('../controllers/locationsController');

// GET /api/locations (read-only, could be public but keeping protected for now)
router.get('/', verifyAuth, locationsController.getAll);

// POST /api/locations
router.post('/', verifyAuth, locationsController.create);

// GET /api/locations/:tag/content
router.get('/:tag/content', verifyAuth, locationsController.getContent);

// POST /api/locations/:tag/products (Assign product)
router.post('/:tag/products', verifyAuth, locationsController.assignProduct);

// DELETE /api/locations/:tag/products/:productId (Unassign product)
router.delete('/:tag/products/:productId', verifyAuth, locationsController.unassignProduct);

// DELETE /api/locations/:name (Delete location)
router.delete('/:name', verifyAuth, locationsController.delete);

module.exports = router;
