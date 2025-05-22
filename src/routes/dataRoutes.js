const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

// Routes
router.get('/:key', dataController.getData);
router.post('/', dataController.createData);
router.put('/:key', dataController.updateData);
router.delete('/:key', dataController.deleteData);

module.exports = router; 