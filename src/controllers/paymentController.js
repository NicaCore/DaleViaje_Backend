const User = require('../models/User');

// Obtener datos de pago del admin
exports.getAdminPaymentInfo = async (req, res) => {
  try {
    // Buscar admin
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    res.json({
      success: true,
      paymentInfo: {
        // Para pagos en Córdobas
        phone: process.env.ADMIN_PHONE,
        bank: process.env.ADMIN_BANK_NAME,
        account: process.env.ADMIN_ACCOUNT_NUMBER,
        accountType: process.env.ADMIN_ACCOUNT_TYPE,
        currency: 'Córdobas',
        
        // Para pagos en USD
        usdPhone: process.env.ADMIN_USD_PHONE,
        usdBank: process.env.ADMIN_USD_BANK,
        usdAccount: process.env.ADMIN_USD_ACCOUNT,
        usdCurrency: 'USD',
        
        // Mensajes
        messages: {
          business: process.env.PAYMENT_MESSAGE_NEGOCIO,
          mandadito: process.env.PAYMENT_MESSAGE_MANDADITO
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo datos de pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de pago'
    });
  }
};

// Generar referencia de pago
exports.generatePaymentReference = async (req, res) => {
  try {
    const { type } = req.body; // 'business' o 'credits'
    const userId = req.userId;

    let prefix = '';
    if (type === 'business') {
      prefix = 'NEG';
    } else if (type === 'credits') {
      prefix = 'CRED';
    } else {
      prefix = 'PAY';
    }

    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reference = `${prefix}-${timestamp}-${random}`;

    res.json({
      success: true,
      reference,
      message: 'Referencia generada. Usa este código al hacer el pago.'
    });

  } catch (error) {
    console.error('Error generando referencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar referencia'
    });
  }
};