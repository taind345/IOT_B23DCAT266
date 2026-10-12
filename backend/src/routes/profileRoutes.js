const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// GET /api/profile
router.get('/', authenticateToken, AuthController.getProfile);

// PUT /api/profile
router.put('/', authenticateToken, AuthController.updateProfile);

module.exports = router;
