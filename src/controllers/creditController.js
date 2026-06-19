const { CreditPackage, CreditPurchase } = require('../models/CreditPackage');
const Mandadito = require('../models/Mandadito');
const User = require('../models/User');
const { getImageUrl } = require('../middleware/upload');

// Obtener paquetes de créditos disponibles
exports.getPackages = async (req, res) => {
  try {
    const packages = await CreditPackage.find({ isActive: true })
      .sort({ price: 1 });

    res.json({
      success: true,
      packages
    });
  } catch (error) {
    console.error('Error obteniendo paquetes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener paquetes de créditos'
    });
  }
};

// Comprar paquete de créditos
exports.purchaseCredits = async (req, res) => {
  try {
    const mandaditoId = req.userId;
    const { packageId } = req.body;

    // Verificar que el usuario sea mandadito
    const mandadito = await User.findById(mandaditoId);
    if (!mandadito || mandadito.role !== 'mandadito') {
      return res.status(403).json({
        success: false,
        message: 'Solo los mandaditos pueden comprar créditos'
      });
    }

    // Verificar que el mandadito esté activo
    if (!mandadito.isActive || mandadito.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta no está activa para comprar créditos'
      });
    }

    // Buscar el paquete
    const package = await CreditPackage.findById(packageId);
    if (!package || !package.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no disponible o inactivo'
      });
    }

    // Verificar que se haya subido el comprobante
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'El comprobante de pago es requerido'
      });
    }

    // Crear la compra pendiente
    const purchase = new CreditPurchase({
      mandaditoId,
      packageId: package._id,
      amount: package.price,
      credits: package.credits,
      paymentReceipt: getImageUrl(req.file.filename, 'receipts'),
      status: 'pending'
    });

    await purchase.save();

    res.status(201).json({
      success: true,
      message: 'Compra registrada exitosamente. Esperando aprobación del administrador.',
      purchase: {
        id: purchase._id,
        package: package.name,
        credits: package.credits,
        amount: package.price,
        status: purchase.status,
        createdAt: purchase.createdAt
      }
    });

  } catch (error) {
    console.error('Error comprando créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la compra de créditos'
    });
  }
};

// Obtener historial de compras del mandadito
exports.getPurchaseHistory = async (req, res) => {
  try {
    const mandaditoId = req.userId;

    const purchases = await CreditPurchase.find({ mandaditoId })
      .populate('packageId', 'name credits price')
      .sort({ createdAt: -1 });

    // Formatear la respuesta
    const formattedPurchases = purchases.map(purchase => ({
      id: purchase._id,
      package: purchase.packageId ? purchase.packageId.name : 'Paquete eliminado',
      credits: purchase.credits,
      amount: purchase.amount,
      status: purchase.status,
      receipt: purchase.paymentReceipt,
      adminNotes: purchase.adminNotes,
      createdAt: purchase.createdAt,
      approvedAt: purchase.approvedAt
    }));

    res.json({
      success: true,
      purchases: formattedPurchases,
      total: formattedPurchases.length
    });

  } catch (error) {
    console.error('Error obteniendo historial de compras:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de compras'
    });
  }
};

// Obtener balance de créditos del mandadito
exports.getCreditsBalance = async (req, res) => {
  try {
    const mandaditoId = req.userId;

    const mandadito = await Mandadito.findOne({ userId: mandaditoId });
    if (!mandadito) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de mandadito no encontrado'
      });
    }

    // Calcular créditos usados (historial de entregas)
    const totalCreditsUsed = mandadito.deliveryHistory.reduce(
      (sum, delivery) => sum + delivery.creditsDeducted, 
      0
    );

    res.json({
      success: true,
      balance: {
        total: mandadito.credits,
        used: totalCreditsUsed,
        available: mandadito.credits,
        isFeatured: mandadito.credits >= 150,
        totalDeliveries: mandadito.totalDeliveries,
        earnings: mandadito.earnings
      }
    });

  } catch (error) {
    console.error('Error obteniendo balance de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener balance de créditos'
    });
  }
};

// Obtener historial de transacciones (créditos usados en entregas)
exports.getTransactionsHistory = async (req, res) => {
  try {
    const mandaditoId = req.userId;

    const mandadito = await Mandadito.findOne({ userId: mandaditoId })
      .populate('deliveryHistory.orderId', 'voucherCode description amount pickupAddress deliveryAddress');

    if (!mandadito) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de mandadito no encontrado'
      });
    }

    // Formatear el historial de entregas
    const transactions = mandadito.deliveryHistory.map(delivery => ({
      id: delivery._id,
      orderId: delivery.orderId?._id || null,
      voucherCode: delivery.orderId?.voucherCode || 'N/A',
      description: delivery.orderId?.description || 'Entrega',
      amount: delivery.amount,
      creditsDeducted: delivery.creditsDeducted,
      distance: delivery.distance,
      date: delivery.date,
      pickupAddress: delivery.orderId?.pickupAddress || 'N/A',
      deliveryAddress: delivery.orderId?.deliveryAddress || 'N/A'
    }));

    res.json({
      success: true,
      transactions,
      total: transactions.length,
      totalCreditsUsed: mandadito.deliveryHistory.reduce(
        (sum, delivery) => sum + delivery.creditsDeducted, 
        0
      )
    });

  } catch (error) {
    console.error('Error obteniendo historial de transacciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de transacciones'
    });
  }
};

// Obtener detalles de una compra específica
exports.getPurchaseDetails = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const mandaditoId = req.userId;

    const purchase = await CreditPurchase.findOne({
      _id: purchaseId,
      mandaditoId
    }).populate('packageId', 'name credits price description');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    res.json({
      success: true,
      purchase: {
        id: purchase._id,
        package: purchase.packageId || { name: 'Paquete eliminado' },
        credits: purchase.credits,
        amount: purchase.amount,
        status: purchase.status,
        receipt: purchase.paymentReceipt,
        adminNotes: purchase.adminNotes,
        createdAt: purchase.createdAt,
        approvedAt: purchase.approvedAt,
        approvedBy: purchase.approvedBy
      }
    });

  } catch (error) {
    console.error('Error obteniendo detalles de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles de la compra'
    });
  }
};