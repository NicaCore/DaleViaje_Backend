const User = require('../models/User');
const Client = require('../models/Client');
const Mandadito = require('../models/Mandadito');
const Business = require('../models/Business');
const Order = require('../models/Order');
const Report = require('../models/Report');
const { CreditPackage, CreditPurchase } = require('../models/CreditPackage');
const Chat = require('../models/Chat');

// ============================================
// DASHBOARD - ESTADÍSTICAS
// ============================================

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalClients,
      totalMandaditos,
      totalBusinesses,
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      pendingBusinesses,
      totalReports,
      pendingReports,
      totalCreditPurchases,
      pendingCreditPurchases,
      totalEarnings
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Client.countDocuments(),
      Mandadito.countDocuments(),
      Business.countDocuments({ isApproved: true, isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'completed' }),
      Order.countDocuments({ status: 'cancelled' }),
      Business.countDocuments({ isApproved: false, paymentStatus: 'pending' }),
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      CreditPurchase.countDocuments(),
      CreditPurchase.countDocuments({ status: 'pending' }),
      Mandadito.aggregate([{ $group: { _id: null, total: { $sum: '$earnings' } } }])
    ]);

    // Usuarios por rol
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Órdenes por día (últimos 7 días)
    const ordersByDay = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Mandaditos destacados (créditos >= 150)
    const featuredMandaditos = await Mandadito.countDocuments({ credits: { $gte: 150 } });

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          clients: totalClients,
          mandaditos: totalMandaditos,
          businesses: totalBusinesses,
          featuredMandaditos,
          byRole: usersByRole
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
          byDay: ordersByDay
        },
        businesses: {
          total: totalBusinesses,
          pending: pendingBusinesses
        },
        reports: {
          total: totalReports,
          pending: pendingReports
        },
        credits: {
          totalPurchases: totalCreditPurchases,
          pending: pendingCreditPurchases
        },
        earnings: {
          total: totalEarnings.length > 0 ? totalEarnings[0].total : 0
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard'
    });
  }
};

// ============================================
// USUARIOS
// ============================================

exports.getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = req.query;

    const filter = { isActive: true };
    
    if (role && role !== 'all') {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortBy]: parseInt(sortOrder) })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password'),
      User.countDocuments(filter)
    ]);

    // Obtener perfiles según el rol
    const usersWithProfiles = await Promise.all(users.map(async (user) => {
      let profile = null;
      if (user.role === 'client') {
        profile = await Client.findOne({ userId: user._id });
      } else if (user.role === 'mandadito') {
        profile = await Mandadito.findOne({ userId: user._id });
      } else if (user.role === 'business') {
        profile = await Business.findOne({ userId: user._id });
      }
      return {
        ...user.toJSON(),
        profile
      };
    }));

    res.json({
      success: true,
      users: usersWithProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    let profile = null;
    let stats = {};

    if (user.role === 'client') {
      profile = await Client.findOne({ userId: user._id })
        .populate('orders', 'voucherCode amount status createdAt');
      stats = {
        totalOrders: profile?.totalOrders || 0,
        reviews: profile?.reviews?.length || 0,
        averageRating: profile?.averageRating || 0
      };
    } else if (user.role === 'mandadito') {
      profile = await Mandadito.findOne({ userId: user._id })
        .populate('activeOrders', 'voucherCode amount status');
      stats = {
        credits: profile?.credits || 0,
        isFeatured: profile?.isFeatured || false,
        totalDeliveries: profile?.totalDeliveries || 0,
        earnings: profile?.earnings || 0,
        activeOrders: profile?.activeOrders?.length || 0,
        rating: profile?.rating || 0
      };
    } else if (user.role === 'business') {
      profile = await Business.findOne({ userId: user._id });
      stats = {
        isApproved: profile?.isApproved || false,
        paymentStatus: profile?.paymentStatus || 'pending',
        totalOrders: profile?.totalOrders || 0,
        catalogItems: profile?.catalog?.length || 0
      };
    }

    // Órdenes del usuario
    const orders = await Order.find({ 
      $or: [
        { clientId: user._id },
        { mandaditoId: user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('clientId', 'firstName lastName email')
    .populate('mandaditoId', 'firstName lastName email');

    res.json({
      success: true,
      user,
      profile,
      stats,
      recentOrders: orders
    });

  } catch (error) {
    console.error('Error obteniendo detalles de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del usuario'
    });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No se puede bloquear al administrador'
      });
    }

    user.isBlocked = true;
    await user.save();

    res.json({
      success: true,
      message: `Usuario ${user.firstName} ${user.lastName} bloqueado exitosamente`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isBlocked: user.isBlocked
      }
    });

  } catch (error) {
    console.error('Error bloqueando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al bloquear usuario'
    });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    user.isBlocked = false;
    await user.save();

    res.json({
      success: true,
      message: `Usuario ${user.firstName} ${user.lastName} desbloqueado exitosamente`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isBlocked: user.isBlocked
      }
    });

  } catch (error) {
    console.error('Error desbloqueando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desbloquear usuario'
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No se puede eliminar al administrador'
      });
    }

    // Eliminar perfil según rol
    if (user.role === 'client') {
      await Client.findOneAndDelete({ userId: user._id });
    } else if (user.role === 'mandadito') {
      await Mandadito.findOneAndDelete({ userId: user._id });
    } else if (user.role === 'business') {
      await Business.findOneAndDelete({ userId: user._id });
    }

    // Eliminar usuario
    await user.deleteOne();

    res.json({
      success: true,
      message: `Usuario ${user.firstName} ${user.lastName} eliminado exitosamente`
    });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
};

// ============================================
// NEGOCIOS
// ============================================

exports.getBusinesses = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) {
      if (status === 'pending') {
        filter.isApproved = false;
        filter.paymentStatus = 'pending';
      } else if (status === 'approved') {
        filter.isApproved = true;
        filter.isActive = true;
      } else if (status === 'rejected') {
        filter.isApproved = false;
        filter.paymentStatus = 'rejected';
      }
    }

    if (search) {
      filter.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [businesses, total] = await Promise.all([
      Business.find(filter)
        .populate('userId', 'firstName lastName email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Business.countDocuments(filter)
    ]);

    res.json({
      success: true,
      businesses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo negocios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener negocios'
    });
  }
};

exports.getBusinessDetails = async (req, res) => {
  try {
    const { businessId } = req.params;

    const business = await Business.findById(businessId)
      .populate('userId', 'firstName lastName email phone');

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
    }

    // Obtener órdenes de este negocio
    const orders = await Order.find({ businessId: business._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('clientId', 'firstName lastName email')
      .populate('mandaditoId', 'firstName lastName email');

    res.json({
      success: true,
      business,
      orders,
      totalOrders: orders.length
    });

  } catch (error) {
    console.error('Error obteniendo detalles del negocio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del negocio'
    });
  }
};

exports.approveBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
    }

    business.isApproved = true;
    business.paymentStatus = 'approved';
    business.isActive = true;
    await business.save();

    // Actualizar el usuario
    await User.findByIdAndUpdate(business.userId, { isActive: true });

    res.json({
      success: true,
      message: 'Negocio aprobado exitosamente',
      business
    });

  } catch (error) {
    console.error('Error aprobando negocio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aprobar negocio'
    });
  }
};

exports.rejectBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { reason } = req.body;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
    }

    business.isApproved = false;
    business.paymentStatus = 'rejected';
    business.isActive = false;
    await business.save();

    res.json({
      success: true,
      message: 'Negocio rechazado',
      business,
      reason: reason || 'No especificado'
    });

  } catch (error) {
    console.error('Error rechazando negocio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar negocio'
    });
  }
};

// ============================================
// CRÉDITOS - COMPRAS
// ============================================

exports.getCreditPurchases = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [purchases, total] = await Promise.all([
      CreditPurchase.find(filter)
        .populate('mandaditoId', 'firstName lastName email phone')
        .populate('packageId', 'name credits price')
        .populate('approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CreditPurchase.countDocuments(filter)
    ]);

    res.json({
      success: true,
      purchases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo compras de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener compras de créditos'
    });
  }
};

exports.approveCreditPurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const adminId = req.userId;

    const purchase = await CreditPurchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    if (purchase.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Esta compra ya fue procesada'
      });
    }

    // Actualizar la compra
    purchase.status = 'approved';
    purchase.approvedAt = new Date();
    purchase.approvedBy = adminId;
    await purchase.save();

    // Agregar créditos al mandadito
    const mandadito = await Mandadito.findOne({ userId: purchase.mandaditoId });
    if (mandadito) {
      mandadito.credits += purchase.credits;
      
      // Verificar si ahora es destacado
      if (mandadito.credits >= 150) {
        mandadito.isFeatured = true;
      }
      
      await mandadito.save();
    }

    res.json({
      success: true,
      message: 'Compra aprobada y créditos agregados',
      purchase,
      creditsAdded: purchase.credits
    });

  } catch (error) {
    console.error('Error aprobando compra de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aprobar compra de créditos'
    });
  }
};

exports.rejectCreditPurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { reason } = req.body;

    const purchase = await CreditPurchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    if (purchase.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Esta compra ya fue procesada'
      });
    }

    purchase.status = 'rejected';
    purchase.adminNotes = reason || 'Rechazado por el administrador';
    await purchase.save();

    res.json({
      success: true,
      message: 'Compra rechazada',
      purchase
    });

  } catch (error) {
    console.error('Error rechazando compra de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar compra de créditos'
    });
  }
};

// ============================================
// ÓRDENES
// ============================================

exports.getOrders = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20, search } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (type && type !== 'all') {
      filter.type = type;
    }
    if (search) {
      filter.$or = [
        { voucherCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('clientId', 'firstName lastName email phone')
        .populate('mandaditoId', 'firstName lastName email phone')
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
    console.error('Error obteniendo órdenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes'
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('clientId', 'firstName lastName email phone profilePhoto')
      .populate('mandaditoId', 'firstName lastName email phone profilePhoto')
      .populate('businessId', 'businessName profilePhoto address')
      .populate('chatId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Error obteniendo detalles de la orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles de la orden'
    });
  }
};

// ============================================
// REPORTES
// ============================================

exports.getReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate('reporterId', 'firstName lastName email role')
        .populate('reportedId', 'firstName lastName email role')
        .populate('orderId', 'voucherCode description amount')
        .populate('resolvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);

    res.json({
      success: true,
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo reportes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener reportes'
    });
  }
};

exports.resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.userId;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    if (report.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Este reporte ya fue resuelto'
      });
    }

    report.status = 'resolved';
    report.isResolved = true;
    report.adminNotes = adminNotes || 'Resuelto por el administrador';
    report.resolvedAt = new Date();
    report.resolvedBy = adminId;
    await report.save();

    res.json({
      success: true,
      message: 'Reporte resuelto exitosamente',
      report
    });

  } catch (error) {
    console.error('Error resolviendo reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al resolver reporte'
    });
  }
};

exports.rejectReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { adminNotes } = req.body;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    if (report.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Este reporte ya fue resuelto'
      });
    }

    report.status = 'rejected';
    report.adminNotes = adminNotes || 'Rechazado por el administrador';
    await report.save();

    res.json({
      success: true,
      message: 'Reporte rechazado',
      report
    });

  } catch (error) {
    console.error('Error rechazando reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar reporte'
    });
  }
};

// ============================================
// PAQUETES DE CRÉDITOS
// ============================================

exports.createCreditPackage = async (req, res) => {
  try {
    const { name, credits, price, description } = req.body;

    // Verificar si ya existe un paquete con ese nombre
    const existing = await CreditPackage.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un paquete con ese nombre'
      });
    }

    const package = new CreditPackage({
      name,
      credits: parseInt(credits),
      price: parseFloat(price),
      description,
      isActive: true
    });

    await package.save();

    res.status(201).json({
      success: true,
      message: 'Paquete de créditos creado exitosamente',
      package
    });

  } catch (error) {
    console.error('Error creando paquete de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear paquete de créditos'
    });
  }
};

exports.updateCreditPackage = async (req, res) => {
  try {
    const { packageId } = req.params;
    const updates = req.body;

    const package = await CreditPackage.findById(packageId);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    // Campos permitidos para actualizar
    const allowedUpdates = ['name', 'credits', 'price', 'description', 'isActive'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        package[field] = updates[field];
      }
    });

    await package.save();

    res.json({
      success: true,
      message: 'Paquete actualizado exitosamente',
      package
    });

  } catch (error) {
    console.error('Error actualizando paquete de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar paquete de créditos'
    });
  }
};

exports.deleteCreditPackage = async (req, res) => {
  try {
    const { packageId } = req.params;

    const package = await CreditPackage.findById(packageId);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    // Verificar si tiene compras asociadas
    const hasPurchases = await CreditPurchase.findOne({ packageId: package._id });
    if (hasPurchases) {
      // En lugar de eliminar, desactivar
      package.isActive = false;
      await package.save();
      return res.json({
        success: true,
        message: 'Paquete desactivado (tiene compras asociadas)',
        package
      });
    }

    await package.deleteOne();

    res.json({
      success: true,
      message: 'Paquete eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando paquete de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar paquete de créditos'
    });
  }
};

// ============================================
// SISTEMA - LOGS
// ============================================

exports.getSystemLogs = async (req, res) => {
  try {
    // Aquí se pueden implementar logs del sistema
    // Por ahora devolvemos estadísticas básicas
    const stats = {
      totalUsers: await User.countDocuments(),
      totalOrders: await Order.countDocuments(),
      totalReports: await Report.countDocuments(),
      totalCreditPurchases: await CreditPurchase.countDocuments(),
      pendingCreditPurchases: await CreditPurchase.countDocuments({ status: 'pending' }),
      pendingReports: await Report.countDocuments({ status: 'pending' }),
      lastHourOrders: await Order.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      }),
      lastDayOrders: await Order.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo logs del sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener logs del sistema'
    });
  }
};