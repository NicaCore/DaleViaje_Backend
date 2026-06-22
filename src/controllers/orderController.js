// src/controllers/orderController.js - VERSIÓN DEFINITIVA
const Order = require('../models/Order');
const User = require('../models/User');
const Client = require('../models/Client');
const Mandadito = require('../models/Mandadito');
const Business = require('../models/Business');
const Chat = require('../models/Chat');
const { calculateDistance, calculatePrice } = require('../utils/distanceCalculator');

// ============================================
// CREAR MANDADO PÚBLICO - DEFINITIVO
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

    console.log('📝 Creando mandado:');
    console.log('  pickupLocation:', JSON.stringify(pickupLocation));
    console.log('  deliveryLocation:', JSON.stringify(deliveryLocation));

    // ✅ EXTRAER COORDENADAS DE CUALQUIER FORMATO
    let pickupCoords = null;
    let deliveryCoords = null;

    // Formato 1: { coordinates: [lng, lat] }
    if (pickupLocation?.coordinates && Array.isArray(pickupLocation.coordinates) && pickupLocation.coordinates.length === 2) {
      pickupCoords = pickupLocation.coordinates.map(Number);
    }
    // Formato 2: { lat: x, lng: y }
    else if (pickupLocation?.lat !== undefined && pickupLocation?.lng !== undefined) {
      pickupCoords = [Number(pickupLocation.lng), Number(pickupLocation.lat)];
    }
    // Formato 3: [lng, lat]
    else if (Array.isArray(pickupLocation) && pickupLocation.length === 2) {
      pickupCoords = pickupLocation.map(Number);
    }

    if (deliveryLocation?.coordinates && Array.isArray(deliveryLocation.coordinates) && deliveryLocation.coordinates.length === 2) {
      deliveryCoords = deliveryLocation.coordinates.map(Number);
    }
    else if (deliveryLocation?.lat !== undefined && deliveryLocation?.lng !== undefined) {
      deliveryCoords = [Number(deliveryLocation.lng), Number(deliveryLocation.lat)];
    }
    else if (Array.isArray(deliveryLocation) && deliveryLocation.length === 2) {
      deliveryCoords = deliveryLocation.map(Number);
    }

    // ✅ VALIDAR COORDENADAS
    if (!pickupCoords || pickupCoords.length !== 2 || isNaN(pickupCoords[0]) || isNaN(pickupCoords[1])) {
      console.log('❌ pickupCoords inválido:', pickupCoords);
      return res.status(400).json({
        success: false,
        message: 'Coordenadas de recogida inválidas. Debe ser [longitud, latitud]'
      });
    }

    if (!deliveryCoords || deliveryCoords.length !== 2 || isNaN(deliveryCoords[0]) || isNaN(deliveryCoords[1])) {
      console.log('❌ deliveryCoords inválido:', deliveryCoords);
      return res.status(400).json({
        success: false,
        message: 'Coordenadas de entrega inválidas. Debe ser [longitud, latitud]'
      });
    }

    console.log('  pickupCoords:', pickupCoords);
    console.log('  deliveryCoords:', deliveryCoords);

    const distance = calculateDistance(pickupCoords, deliveryCoords);
    const amount = calculatePrice(distance);

    console.log(`  Distancia: ${distance}km, Precio: C$${amount}`);

    // ✅ CREAR ORDEN CON GeoJSON VÁLIDO
    const orderData = {
      clientId,
      type: 'public',
      description: description || 'Mandado sin descripción',
      pickupAddress: pickupAddress || 'Dirección no especificada',
      pickupLocation: {
        type: 'Point',
        coordinates: pickupCoords
      },
      deliveryAddress: deliveryAddress || 'Dirección no especificada',
      deliveryLocation: {
        type: 'Point',
        coordinates: deliveryCoords
      },
      distance: distance,
      amount: amount,
      status: 'pending',
      businessId: businessId || null
    };

    console.log('📦 Guardando orden con pickupLocation:', JSON.stringify(orderData.pickupLocation));
    console.log('📦 Guardando orden con deliveryLocation:', JSON.stringify(orderData.deliveryLocation));

    const order = new Order(orderData);
    await order.save();

    console.log('✅ Orden guardada:', order._id);

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
    console.error('❌ Error creando mandado:');
    console.error('  Mensaje:', error.message);
    console.error('  Stack:', error.stack);
    console.error('  Body:', JSON.stringify(req.body, null, 2));
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
    }

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

    // ✅ EXTRAER COORDENADAS
    let pickupCoords = null;
    let deliveryCoords = null;

    if (pickupLocation?.coordinates && Array.isArray(pickupLocation.coordinates) && pickupLocation.coordinates.length === 2) {
      pickupCoords = pickupLocation.coordinates.map(Number);
    }
    else if (pickupLocation?.lat !== undefined && pickupLocation?.lng !== undefined) {
      pickupCoords = [Number(pickupLocation.lng), Number(pickupLocation.lat)];
    }
    else if (Array.isArray(pickupLocation) && pickupLocation.length === 2) {
      pickupCoords = pickupLocation.map(Number);
    }

    if (deliveryLocation?.coordinates && Array.isArray(deliveryLocation.coordinates) && deliveryLocation.coordinates.length === 2) {
      deliveryCoords = deliveryLocation.coordinates.map(Number);
    }
    else if (deliveryLocation?.lat !== undefined && deliveryLocation?.lng !== undefined) {
      deliveryCoords = [Number(deliveryLocation.lng), Number(deliveryLocation.lat)];
    }
    else if (Array.isArray(deliveryLocation) && deliveryLocation.length === 2) {
      deliveryCoords = deliveryLocation.map(Number);
    }

    if (!pickupCoords || pickupCoords.length !== 2 || isNaN(pickupCoords[0]) || isNaN(pickupCoords[1])) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas de recogida inválidas'
      });
    }

    if (!deliveryCoords || deliveryCoords.length !== 2 || isNaN(deliveryCoords[0]) || isNaN(deliveryCoords[1])) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas de entrega inválidas'
      });
    }

    const distance = calculateDistance(pickupCoords, deliveryCoords);
    const amount = calculatePrice(distance);

    const orderData = {
      clientId,
      mandaditoId,
      type: 'assigned',
      description: description || 'Mandado sin descripción',
      pickupAddress: pickupAddress || 'Dirección no especificada',
      pickupLocation: {
        type: 'Point',
        coordinates: pickupCoords
      },
      deliveryAddress: deliveryAddress || 'Dirección no especificada',
      deliveryLocation: {
        type: 'Point',
        coordinates: deliveryCoords
      },
      distance: distance,
      amount: amount,
      status: 'accepted',
      businessId: businessId || null
    };

    const order = new Order(orderData);
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
      { $push: { activeOrders: order._id } }
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
// RESTO DE FUNCIONES
// ============================================
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = 20, page = 1 } = req.query;

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

exports.getAvailableOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      status: 'pending',
      type: 'public'
    })
    .populate('clientId', 'firstName lastName email phone profilePhoto')
    .populate('businessId', 'businessName profilePhoto')
    .sort({ createdAt: -1 });

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

exports.acceptPublicOrder = async (req, res) => {
  try {
    const mandaditoId = req.userId;
    const { orderId } = req.params;

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

// ===== FUNCIONES ADICIONALES =====
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

    res.json({
      success: true,
      message: 'Calificación enviada'
    });

  } catch (error) {
    console.error('❌ Error calificando:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calificar'
    });
  }
};

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

    res.json({
      success: true,
      tracking: {
        status: order.status,
        updates: order.tracking?.updates || []
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