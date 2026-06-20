// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('../controllers/notificationController');

// Todas las rutas requieren autenticación
router.use(auth);

router.get('/', getUserNotifications);
router.put('/:notificationId/read', markNotificationAsRead);
router.put('/read-all', markAllNotificationsAsRead);

module.exports = router;