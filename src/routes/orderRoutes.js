// src/routes/orderRoutes.js - VERSIÓN CORREGIDA
const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');

// ✅ Importar TODAS las funciones del controlador
const {
  createPublicOrder,
  createAssignedOrder,
  getMyOrders,
  getAvailableOrders,
  acceptPublicOrder,
  completeOrder,
  cancelOrder,
  requestCreditRefund
} = require('../controllers/orderController');

// ===== TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN =====
router.use(auth);

// ===== OBTENER ÓRDENES =====
router.get('/', getMyOrders);
router.get('/available', checkRole(['mandadito']), getAvailableOrders);

// ===== CLIENTES =====
router.post('/public', checkRole(['client']), validateOrder, createPublicOrder);
router.post('/assigned', checkRole(['client']), validateOrder, createAssignedOrder);
router.put('/:orderId/cancel', checkRole(['client']), cancelOrder);

// ===== MANDADITOS =====
router.put('/:orderId/accept', checkRole(['mandadito']), acceptPublicOrder);
router.put('/:orderId/complete', checkRole(['mandadito']), completeOrder);
router.post('/:orderId/refund', checkRole(['mandadito']), requestCreditRefund);

module.exports = router;