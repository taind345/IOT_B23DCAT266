const express = require('express');
const router = express.Router();
const HistoryController = require('../controllers/historyController');

// GET /api/history/sensors
router.get('/sensors', HistoryController.getSensors);

// GET /api/history/actions
router.get('/actions', HistoryController.getActions);

module.exports = router;
