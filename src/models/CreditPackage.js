const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const creditPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del paquete es requerido'],
    trim: true
  },
  credits: {
    type: Number,
    required: [true, 'La cantidad de créditos es requerida'],
    min: 1
  },
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: 0
  },
  currency: {
    type: String,
    default: 'Córdobas'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

const creditPurchaseSchema = new mongoose.Schema({
  mandaditoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreditPackage',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  credits: {
    type: Number,
    required: true,
    min: 1
  },
  paymentReceipt: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING
  },
  adminNotes: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

creditPackageSchema.index({ isActive: 1 });
creditPurchaseSchema.index({ mandaditoId: 1, status: 1 });

module.exports = {
  CreditPackage: mongoose.model('CreditPackage', creditPackageSchema),
  CreditPurchase: mongoose.model('CreditPurchase', creditPurchaseSchema)
};