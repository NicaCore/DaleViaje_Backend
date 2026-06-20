// src/utils/notificationHelpers.js
const Order = require('../models/Order');

// ===== NUEVO: Enviar notificación de orden =====
const notifyOrderStatus = async (orderId, status, userId, message) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    await order.addNotification(status, message, userId);

    // Aquí iría la lógica para enviar notificación push
    // con FCM si el usuario tiene token

    return true;
  } catch (error) {
    console.error('Error enviando notificación:', error);
    return false;
  }
};

// ===== NUEVO: Notificar a todos los participantes de una orden =====
const notifyOrderParticipants = async (orderId, status, message) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    const participants = [];
    if (order.clientId) participants.push(order.clientId);
    if (order.mandaditoId) participants.push(order.mandaditoId);

    for (const participantId of participants) {
      await order.addNotification(status, message, participantId);
    }

    return true;
  } catch (error) {
    console.error('Error notificando participantes:', error);
    return false;
  }
};

module.exports = {
  notifyOrderStatus,
  notifyOrderParticipants
};