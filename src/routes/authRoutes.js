const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { validateRegister, validateLogin } = require('../middleware/validation');
const {
  register,
  login,
  updateProfile,
  updateLocation,
  logout
} = require('../controllers/authController');

router.post(
  '/register',
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'vehiclePhoto', maxCount: 1 },
    { name: 'licensePhoto', maxCount: 1 },
    { name: 'cedulaPhoto', maxCount: 1 },
    { name: 'businessPhoto', maxCount: 1 },
    { name: 'paymentReceipt', maxCount: 1 }
  ]),
  validateRegister,
  register
);

router.post('/login', validateLogin, login);
router.put('/profile', auth, upload.single('profilePhoto'), updateProfile);
router.put('/location', auth, updateLocation);
router.post('/logout', auth, logout);

module.exports = router;