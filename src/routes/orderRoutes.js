const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const {
  createPublicOrder,
  createAssignedOrder,
  getMyOrders,
  acceptPublicOrder,
  completeOrder,
  cancelOrder,
  requestCreditRefund
} = require('../controllers/orderController');

router.use(auth);

// ===== OBTENER ÓRDENES =====
router.get('/', getMyOrders);

// ===== CLIENTES =====
router.post('/public', checkRole(['client']), createPublicOrder);
router.post('/assigned', checkRole(['client']), createAssignedOrder);
router.put('/:orderId/cancel', checkRole(['client']), cancelOrder);

// ===== MANDADITOS =====
router.put('/:orderId/accept', checkRole(['mandadito']), acceptPublicOrder);
router.put('/:orderId/complete', checkRole(['mandadito']), completeOrder);
router.post('/:orderId/refund', checkRole(['mandadito']), requestCreditRefund);

module.exports = router;