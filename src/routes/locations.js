const express = require('express');
const router = express.Router();
const locationsController = require('../controllers/locationsController');

// GET /api/locations
router.get('/', locationsController.getAll);

// POST /api/locations
router.post('/', locationsController.create);

// GET /api/locations/:tag/content
router.get('/:tag/content', locationsController.getContent);

// POST /api/locations/:tag/products (Assign product)
router.post('/:tag/products', locationsController.assignProduct);

// DELETE /api/locations/:tag/products/:productId (Unassign product)
router.delete('/:tag/products/:productId', locationsController.unassignProduct);

module.exports = router;
