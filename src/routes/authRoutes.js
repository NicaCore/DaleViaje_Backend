// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadRegister } = require('../middleware/upload');
const { validateRegister, validateLogin } = require('../middleware/validation');
const {
  register,
  login,
  updateProfile,
  updateLocation,
  logout
} = require('../controllers/authController');

// ✅ Usamos uploadRegister que permite foto opcional para clientes
router.post(
  '/register',
  uploadRegister,
  validateRegister,
  register
);

router.post('/login', validateLogin, login);
router.put('/profile', auth, uploadRegister, updateProfile);
router.put('/location', auth, updateLocation);
router.post('/logout', auth, logout);

module.exports = router;