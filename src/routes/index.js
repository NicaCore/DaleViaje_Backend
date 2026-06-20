// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const creditRoutes = require('./creditRoutes');
const chatRoutes = require('./chatRoutes');
const adminRoutes = require('./adminRoutes');
const paymentRoutes = require('./paymentRoutes');
const notificationRoutes = require('./notificationRoutes'); // NUEVO

router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/credits', creditRoutes);
router.use('/chats', chatRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes); // NUEVO

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;