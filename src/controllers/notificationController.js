// src/controllers/notificationController.js
const Order = require('../models/Order');

// ===== NUEVO: Obtener notificaciones del usuario =====
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Buscar órdenes del usuario
    const orders = await Order.find({
      $or: [
        { clientId: userId },
        { mandaditoId: userId }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const notifications = [];
    orders.forEach(order => {
      order.notifications.forEach(notif => {
        if (notif.sentTo && notif.sentTo.toString() === userId) {
          notifications.push({
            id: notif._id,
            orderId: order._id,
            voucherCode: order.voucherCode,
            type: notif.type,
            message: notif.message,
            read: notif.read,
            readAt: notif.readAt,
            sentAt: notif.sentAt
          });
        }
      });
    });

    // Ordenar por fecha
    notifications.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    const total = notifications.length;
    const paginated = notifications.slice(0, parseInt(limit));

    res.json({
      success: true,
      notifications: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones'
    });
  }
};

// ===== NUEVO: Marcar notificación como leída =====
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    // Buscar la orden que contiene la notificación
    const order = await Order.findOne({
      'notifications._id': notificationId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    const notification = order.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    if (notification.sentTo.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado'
      });
    }

    notification.read = true;
    notification.readAt = new Date();
    await order.save();

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });

  } catch (error) {
    console.error('Error marcando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar notificación'
    });
  }
};

// ===== NUEVO: Marcar todas las notificaciones como leídas =====
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    // Buscar todas las órdenes del usuario
    const orders = await Order.find({
      $or: [
        { clientId: userId },
        { mandaditoId: userId }
      ]
    });

    let count = 0;
    for (const order of orders) {
      for (const notification of order.notifications) {
        if (notification.sentTo && notification.sentTo.toString() === userId && !notification.read) {
          notification.read = true;
          notification.readAt = new Date();
          count++;
        }
      }
      await order.save();
    }

    res.json({
      success: true,
      message: `${count} notificaciones marcadas como leídas`,
      count
    });

  } catch (error) {
    console.error('Error marcando notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar notificaciones'
    });
  }
};