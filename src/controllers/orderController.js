const Order = require('../models/Order');
const User = require('../models/User');
const Client = require('../models/Client');
const Mandadito = require('../models/Mandadito');
const Business = require('../models/Business');
const Chat = require('../models/Chat');
const { calculateDistance, calculatePrice } = require('../utils/distanceCalculator');

// ============================================
// CREAR MANDADO PÚBLICO
// ============================================
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

    console.log('📝 Creando mandado público:', { description, pickupAddress, deliveryAddress });

    // Validar coordenadas
    if (!pickupLocation?.coordinates || !deliveryLocation?.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Las coordenadas de origen y destino son requeridas'
      });
    }

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
      businessId: businessId || null,
      tracking: {
        status: 'pending',
        updates: [{
          status: 'pending',
          timestamp: new Date(),
          note: 'Mandado creado'
        }]
      }
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

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${clientId}`).emit('new_order', {
        orderId: order._id,
        voucherCode: order.voucherCode
      });
    }

    res.status(201).json({
      success: true,
      message: 'Mandado público creado exitosamente',
      order,
      voucherCode: order.voucherCode,
      distance: distance.toFixed(2),
      amount
    });

  } catch (error) {
    console.error('❌ Error creando mandado público:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mandado',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// CREAR MANDADO ASIGNADO
// ============================================
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

    console.log('📝 Creando mandado asignado:', { description, mandaditoId });

    if (!mandaditoId) {
      return res.status(400).json({
        success: false,
        message: 'Debes seleccionar un mandadito'
      });
    }

    const mandadito = await User.findById(mandaditoId);
    if (!mandadito || mandadito.role !== 'mandadito' || !mandadito.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Mandadito no disponible'
      });
    }

    const mandaditoProfile = await Mandadito.findOne({ userId: mandaditoId });
    if (!mandaditoProfile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de mandadito no encontrado'
      });
    }

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
      businessId: businessId || null,
      tracking: {
        status: 'accepted',
        updates: [{
          status: 'accepted',
          timestamp: new Date(),
          note: 'Mandado asignado y aceptado'
        }]
      }
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

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${mandaditoId}`).emit('new_assigned_order', {
        orderId: order._id,
        voucherCode: order.voucherCode
      });
      io.to(`user_${clientId}`).emit('order_accepted', {
        orderId: order._id,
        voucherCode: order.voucherCode
      });
    }

    res.status(201).json({
      success: true,
      message: 'Mandado asignado exitosamente',
      order,
      voucherCode: order.voucherCode,
      distance: distance.toFixed(2),
      amount
    });

  } catch (error) {
    console.error('❌ Error creando mandado asignado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mandado',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// OBTENER ÓRDENES DEL USUARIO
// ============================================
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = 20, page = 1 } = req.query;

    console.log('📋 Obteniendo órdenes para usuario:', userId);

    const filter = {
      $or: [
        { clientId: userId },
        { mandaditoId: userId }
      ]
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('clientId', 'firstName lastName email profilePhoto')
        .populate('mandaditoId', 'firstName lastName email profilePhoto')
        .populate('businessId', 'businessName profilePhoto')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter)
    ]);

    console.log(`✅ Encontradas ${orders.length} órdenes`);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo órdenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes'
    });
  }
};

// ============================================
// OBTENER ÓRDENES DISPONIBLES
// ============================================
exports.getAvailableOrders = async (req, res) => {
  try {
    console.log('📋 Obteniendo órdenes disponibles');

    const orders = await Order.find({
      status: 'pending',
      type: 'public'
    })
    .populate('clientId', 'firstName lastName email phone profilePhoto')
    .populate('businessId', 'businessName profilePhoto')
    .sort({ createdAt: -1 });

    console.log(`✅ Encontradas ${orders.length} órdenes disponibles`);

    res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('❌ Error obteniendo órdenes disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes disponibles'
    });
  }
};

// ============================================
// ACEPTAR MANDADO PÚBLICO
// ============================================
exports.acceptPublicOrder = async (req, res) => {
  try {
    const mandaditoId = req.userId;
    const { orderId } = req.params;

    console.log('📝 Aceptando mandado:', orderId);

    const mandaditoProfile = await Mandadito.findOne({ userId: mandaditoId });
    if (!mandaditoProfile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de mandadito no encontrado'
      });
    }

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

    // Actualizar tracking
    await order.addTrackingUpdate('accepted', null, 'Mandado aceptado por mandadito');

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${order.clientId}`).emit('order_accepted', {
        orderId: order._id,
        mandaditoId: mandaditoId
      });
    }

    res.json({
      success: true,
      message: 'Mandado aceptado exitosamente',
      order,
      remainingCredits: mandaditoProfile.credits
    });

  } catch (error) {
    console.error('❌ Error aceptando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aceptar mandado'
    });
  }
};

// ============================================
// COMPLETAR MANDADO
// ============================================
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

    if (order.mandaditoId?.toString() !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para completar este mandado'
      });
    }

    order.status = 'completed';
    order.completedAt = new Date();
    await order.save();

    await order.addTrackingUpdate('completed', null, 'Mandado completado');

    const mandadito = await Mandadito.findOne({ userId: order.mandaditoId });
    if (mandadito) {
      mandadito.activeOrders = mandadito.activeOrders.filter(
        id => id.toString() !== orderId
      );
      mandadito.earnings += order.amount;
      mandadito.totalDeliveries += 1;
      await mandadito.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${order.clientId}`).emit('order_completed', {
        orderId: order._id
      });
    }

    res.json({
      success: true,
      message: 'Mandado completado exitosamente',
      order
    });

  } catch (error) {
    console.error('❌ Error completando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar mandado'
    });
  }
};

// ============================================
// CANCELAR MANDADO
// ============================================
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

    await order.addTrackingUpdate('cancelled', null, `Cancelado: ${order.cancellationReason}`);

    if (order.mandaditoId) {
      const mandadito = await Mandadito.findOne({ userId: order.mandaditoId });
      if (mandadito) {
        mandadito.activeOrders = mandadito.activeOrders.filter(
          id => id.toString() !== orderId
        );
        mandadito.credits += 5;
        await mandadito.save();
      }
      
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${order.mandaditoId}`).emit('order_cancelled', {
          orderId: order._id
        });
      }
    }

    res.json({
      success: true,
      message: 'Mandado cancelado exitosamente',
      order
    });

  } catch (error) {
    console.error('❌ Error cancelando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar mandado'
    });
  }
};

// ============================================
// SOLICITAR DEVOLUCIÓN DE CRÉDITOS
// ============================================
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

    if (order.mandaditoId?.toString() !== userId) {
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
    console.error('❌ Error solicitando devolución:', error);
    res.status(500).json({
      success: false,
      message: 'Error al solicitar devolución'
    });
  }
};

// ============================================
// ACTUALIZAR UBICACIÓN
// ============================================
exports.updateOrderLocation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { latitude, longitude } = req.body;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Mandado no encontrado'
      });
    }

    if (order.mandaditoId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado'
      });
    }

    await order.addTrackingUpdate(
      order.status,
      { coordinates: [longitude, latitude] },
      'Ubicación actualizada'
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${order.clientId}`).emit('order_location_update', {
        orderId: order._id,
        latitude,
        longitude
      });
    }

    res.json({
      success: true,
      message: 'Ubicación actualizada',
      location: { latitude, longitude }
    });

  } catch (error) {
    console.error('❌ Error actualizando ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar ubicación'
    });
  }
};

// ============================================
// CALIFICAR MANDADO
// ============================================
exports.rateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, comment, role } = req.body;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Mandado no encontrado'
      });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden calificar mandados completados'
      });
    }

    if (role === 'client' && order.clientId.toString() === userId) {
      order.rating.clientRating = {
        score: rating,
        comment: comment || '',
        ratedAt: new Date()
      };
    } else if (role === 'mandadito' && order.mandaditoId?.toString() === userId) {
      order.rating.mandaditoRating = {
        score: rating,
        comment: comment || '',
        ratedAt: new Date()
      };
    } else {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para calificar este mandado'
      });
    }

    await order.save();

    res.json({
      success: true,
      message: 'Calificación enviada',
      rating: order.rating
    });

  } catch (error) {
    console.error('❌ Error calificando mandado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calificar mandado'
    });
  }
};

// ============================================
// OBTENER SEGUIMIENTO
// ============================================
exports.getOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findById(orderId)
      .populate('clientId', 'firstName lastName profilePhoto')
      .populate('mandaditoId', 'firstName lastName profilePhoto');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Mandado no encontrado'
      });
    }

    const isClient = order.clientId?._id?.toString() === userId;
    const isMandadito = order.mandaditoId?._id?.toString() === userId;
    const isAdmin = req.userRole === 'admin';

    if (!isClient && !isMandadito && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado'
      });
    }

    res.json({
      success: true,
      tracking: {
        status: order.tracking?.status || order.status,
        updates: order.tracking?.updates || [],
        currentLocation: order.tracking?.currentLocation || null,
        estimatedTime: order.tracking?.estimatedTime || null,
        distanceRemaining: order.tracking?.distanceRemaining || null
      },
      order: {
        id: order._id,
        voucherCode: order.voucherCode,
        description: order.description,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        amount: order.amount,
        status: order.status
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo seguimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener seguimiento'
    });
  }
};