const Order = require('../models/Order');
const User = require('../models/User');
const Client = require('../models/Client');
const Mandadito = require('../models/Mandadito');
const Business = require('../models/Business');
const Chat = require('../models/Chat');
const { calculateDistance, calculatePrice } = require('../utils/distanceCalculator');

// Crear mandado público
exports.createPublicOrder = async (req, res) => {
  try {
    const clientId = req.userId;
    const {
      description,
      pickupAddress,
      pickupLocation,
      deliveryAddress,
      deliveryLocation,
      businessId
    } = req.body;

    const distance = calculateDistance(
      pickupLocation.coordinates,
      deliveryLocation.coordinates
    );

    const amount = calculatePrice(distance);

    const order = new Order({
      clientId,
      type: 'public',
      description,
      pickupAddress,
      pickupLocation,
      deliveryAddress,
      deliveryLocation,
      distance,
      amount,
      status: 'pending',
      businessId: businessId || null
    });

    await order.save();

    await Client.findOneAndUpdate(
      { userId: clientId },
      { 
        $push: { orders: order._id },
        $inc: { totalOrders: 1 }
      }
    );

    const chat = new Chat({
      orderId: order._id,
      clientId,
      mandaditoId: null,
      isActive: true
    });
    await chat.save();

    order.chatId = chat._id;
    await order.save();

    res.status(201).json({
      success: true,
      message: 'Mandado público creado exitosamente',
      order,
      voucherCode: order.voucherCode,
      distance: distance.toFixed(2),
      amount
    });

  } catch (error) {
    console.error('Error creando mandado público:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mandado'
    });
  }
};

// Crear mandado asignado
exports.createAssignedOrder = async (req, res) => {
  try {
    const clientId = req.userId;
    const {
      description,
      pickupAddress,
      pickupLocation,
      deliveryAddress,
      deliveryLocation,
      mandaditoId,
      businessId
    } = req.body;

    const mandadito = await User.findById(mandaditoId);
    if (!mandadito || mandadito.role !== 'mandadito' || !mandadito.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Mandadito no disponible'
      });
    }

    const mandaditoProfile = await Mandadito.findOne({ userId: mandaditoId });
    if (mandaditoProfile.activeOrders.length >= mandaditoProfile.maxActiveOrders) {
      return res.status(400).json({
        success: false,
        message: 'Mandadito tiene capacidad completa'
      });
    }

    const distance = calculateDistance(
      pickupLocation.coordinates,
      deliveryLocation.coordinates
    );

    const amount = calculatePrice(distance);

    const order = new Order({
      clientId,
      mandaditoId,
      type: 'assigned',
      description,
      pickupAddress,
      pickupLocation,
      deliveryAddress,
      deliveryLocation,
      distance,
      amount,
      status: 'accepted',
      businessId: businessId || null
    });

    await order.save();

    await Client.findOneAndUpdate(
      { userId: clientId },
      { 
        $push: { orders: order._id },
        $inc: { totalOrders: 1 }
      }
    );

    await Mandadito.findOneAndUpdate(
      { userId: mandaditoId },
      {
        $push: { activeOrders: order._id }
      }
    );

    const chat = new Chat({
      orderId: order._id,
      clientId,
      mandaditoId,
      isActive: true
    });
    await chat.save();

    order.chatId = chat._id;
    await order.save();

    res.status(201).json({
      success: true,
      message: 'Mandado asignado exitosamente',
      order,
      voucherCode: order.voucherCode,
      distance: distance.toFixed(2),
      amount
    });

  } catch (error) {
    console.error('Error creando mandado asignado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mandado'
    });
  }
};

// Aceptar mandado público (mandadito)
exports.acceptPublicOrder = async (req, res) => {
  try {
    const mandaditoId = req.userId;
    const { orderId } = req.params;

    const mandaditoProfile = await Mandadito.findOne({ userId: mandaditoId });
    if (mandaditoProfile.credits < 5) {
      return res.status(400).json({
        success: false,
        message: 'Créditos insuficientes. Necesitas al menos 5 créditos'
      });
    }

    const order = await Order.findById(orderId);
    if (!order || order.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: 'Mandado no disponible'
      });
    }

    if (mandaditoProfile.activeOrders.length >= mandaditoProfile.maxActiveOrders) {
      return res.status(400).json({
        success: false,
        message: 'Tienes capacidad completa'
      });
    }

    order.mandaditoId = mandaditoId;
    order.status = 'accepted';
    await order.save();

    mandaditoProfile.credits -= 5;
    mandaditoProfile.activeOrders.push(order._id);
    mandaditoProfile.deliveryHistory.push({
      orderId: order._id,
      amount: order.amount,
      creditsDeducted: 5,
      distance: order.distance
    });
    await mandaditoProfile.save();

    await Chat.findByIdAndUpdate(
      order.chatId,
      { mandaditoId }
    );

    res.json({
      success: true,
      message: 'Mandado aceptado exitosamente',
      order,
      remainingCredits: mandaditoProfile.credits
    });

  } catch (error) {
    console.error('Error aceptando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aceptar mandado'
    });
  }
};

// Completar mandado
exports.completeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Mandado no encontrado'
      });
    }

    if (order.mandaditoId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para completar este mandado'
      });
    }

    order.status = 'completed';
    order.completedAt = new Date();
    await order.save();

    await Mandadito.findOneAndUpdate(
      { userId: order.mandaditoId },
      { 
        $pull: { activeOrders: order._id },
        $inc: { earnings: order.amount, totalDeliveries: 1 }
      }
    );

    res.json({
      success: true,
      message: 'Mandado completado exitosamente',
      order
    });

  } catch (error) {
    console.error('Error completando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar mandado'
    });
  }
};

// Cancelar mandado (solo cliente)
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Mandado no encontrado'
      });
    }

    if (order.clientId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el cliente puede cancelar el mandado'
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar un mandado completado'
      });
    }

    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelado por el cliente';
    await order.save();

    if (order.mandaditoId) {
      await Mandadito.findOneAndUpdate(
        { userId: order.mandaditoId },
        {
          $pull: { activeOrders: order._id },
          $inc: { credits: 5 }
        }
      );
    }

    res.json({
      success: true,
      message: 'Mandado cancelado exitosamente',
      order
    });

  } catch (error) {
    console.error('Error cancelando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar mandado'
    });
  }
};

// Solicitar devolución de créditos
exports.requestCreditRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Mandado no encontrado'
      });
    }

    if (order.mandaditoId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado'
      });
    }

    if (order.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden solicitar devoluciones en mandados cancelados'
      });
    }

    if (order.creditRefundRequested) {
      return res.status(400).json({
        success: false,
        message: 'Ya se solicitó devolución para este mandado'
      });
    }

    order.creditRefundRequested = true;
    order.creditRefundStatus = 'pending';
    await order.save();

    res.json({
      success: true,
      message: 'Solicitud de devolución enviada',
      order
    });

  } catch (error) {
    console.error('Error solicitando devolución:', error);
    res.status(500).json({
      success: false,
      message: 'Error al solicitar devolución'
    });
  }
};