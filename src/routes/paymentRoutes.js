const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getAdminPaymentInfo,
  generatePaymentReference
} = require('../controllers/paymentController');

// Rutas públicas (para ver datos de pago)
router.get('/admin-info', getAdminPaymentInfo);

// Rutas protegidas
router.post('/generate-reference', auth, generatePaymentReference);

module.exports = router;