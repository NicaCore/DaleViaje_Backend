const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');
const {
  createPublicOrder,
  createAssignedOrder,
  acceptPublicOrder,
  completeOrder,
  cancelOrder,
  requestCreditRefund
} = require('../controllers/orderController');

// Clientes
router.post('/public', auth, checkRole(['client']), validateOrder, createPublicOrder);
router.post('/assigned', auth, checkRole(['client']), validateOrder, createAssignedOrder);
router.put('/:orderId/cancel', auth, checkRole(['client']), cancelOrder);

// Mandaditos
router.put('/:orderId/accept', auth, checkRole(['mandadito']), acceptPublicOrder);
router.put('/:orderId/complete', auth, checkRole(['mandadito']), completeOrder);
router.post('/:orderId/refund', auth, checkRole(['mandadito']), requestCreditRefund);

module.exports = router;