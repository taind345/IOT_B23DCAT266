const express = require('express');
const router = express.Router();
const SensorController = require('../controllers/sensorController');

// GET /api/v1/sensors/data/latest 
// (Document ghi GET /api/sensors/latest, ta hỗ trợ route theo yêu cầu)
router.get('/data/latest', SensorController.getLatestData);
router.get('/latest', SensorController.getLatestData); // Alias cho chuẩn MASTER_DOCUMENT

module.exports = router;
