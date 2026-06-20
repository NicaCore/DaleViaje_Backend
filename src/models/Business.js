// src/models/Business.js
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
  paymentReference: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
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
  },
  // ========== NUEVOS CAMPOS ==========
  stats: {
    totalSales: {
      type: Number,
      default: 0
    },
    weeklySales: {
      type: Number,
      default: 0
    },
    monthlySales: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    }
  },
  schedule: {
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: false } }
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

businessSchema.methods.updateStats = async function(amount) {
  this.totalOrders += 1;
  this.stats.totalSales += 1;
  this.stats.totalRevenue += amount;
  return this.save();
};

module.exports = mongoose.model('Business', businessSchema);