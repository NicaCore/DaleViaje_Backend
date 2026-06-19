const mongoose = require('mongoose');
const { BUSINESS_TYPES, PAYMENT_STATUS } = require('../config/constants');

const businessSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: [true, 'El nombre del negocio es requerido'],
    trim: true,
    maxlength: 100
  },
  businessType: {
    type: String,
    required: true,
    enum: Object.values(BUSINESS_TYPES)
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    maxlength: 500
  },
  address: {
    type: String,
    required: [true, 'La dirección es requerida']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  profilePhoto: {
    type: String,
    required: true
  },
  catalog: [{
    image: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 200
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isApproved: {
    type: Boolean,
    default: false
  },
  paymentReceipt: {
    type: String,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING
  },
  // NUEVO: Referencia de pago para el negocio
  paymentReference: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
  // NUEVO: Fecha de pago
  paymentDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  }
}, {
  timestamps: true
});

// Índices
businessSchema.index({ userId: 1 });
businessSchema.index({ businessType: 1 });
businessSchema.index({ location: '2dsphere' });
businessSchema.index({ isApproved: 1, isActive: 1 });
businessSchema.index({ paymentReference: 1 });

module.exports = mongoose.model('Business', businessSchema);