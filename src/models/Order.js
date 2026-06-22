// src/models/Order.js - VERSIÓN FINAL ABSOLUTA
const mongoose = require('mongoose');
const { ORDER_STATUS, ORDER_TYPES } = require('../config/constants');

const orderSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mandaditoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    default: null
  },
  type: {
    type: String,
    enum: Object.values(ORDER_TYPES),
    required: true
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    maxlength: 500
  },
  pickupAddress: {
    type: String,
    required: [true, 'La dirección de recogida es requerida']
  },
  // ✅ SIMPLE: solo guardamos un array de números
  pickupLocation: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 2 &&
          typeof v[0] === 'number' && typeof v[1] === 'number' &&
          !isNaN(v[0]) && !isNaN(v[1]);
      },
      message: 'pickupLocation debe ser un array de 2 números [longitud, latitud]'
    }
  },
  deliveryAddress: {
    type: String,
    required: [true, 'La dirección de entrega es requerida']
  },
  deliveryLocation: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 2 &&
          typeof v[0] === 'number' && typeof v[1] === 'number' &&
          !isNaN(v[0]) && !isNaN(v[1]);
      },
      message: 'deliveryLocation debe ser un array de 2 números [longitud, latitud]'
    }
  },
  distance: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  voucherCode: {
    type: String,
    unique: true
  },
  businessProducts: [{
    name: String,
    quantity: Number,
    price: Number,
    total: Number
  }],
  totalBusinessAmount: {
    type: Number,
    default: 0
  },
  cancellationReason: {
    type: String,
    default: null
  },
  creditRefundRequested: {
    type: Boolean,
    default: false
  },
  creditRefundStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', null],
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    default: null
  },
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS)
    },
    date: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  // ✅ SIMPLE: tracking sin 2dsphere
  tracking: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    updates: [{
      status: String,
      location: {
        type: [Number],
        default: null
      },
      timestamp: { type: Date, default: Date.now },
      note: String,
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    currentLocation: {
      type: [Number],
      default: null
    },
    updatedAt: Date,
    estimatedTime: { type: Number, default: null },
    distanceRemaining: { type: Number, default: null }
  },
  notifications: [{
    type: {
      type: String,
      enum: ['order_created', 'order_accepted', 'order_in_progress', 'order_completed', 'order_cancelled', 'message', 'location_update']
    },
    message: String,
    sentTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    read: { type: Boolean, default: false },
    readAt: Date,
    sentAt: { type: Date, default: Date.now }
  }],
  rating: {
    clientRating: {
      score: { type: Number, min: 1, max: 5, default: null },
      comment: String,
      ratedAt: Date
    },
    mandaditoRating: {
      score: { type: Number, min: 1, max: 5, default: null },
      comment: String,
      ratedAt: Date
    }
  }
}, {
  timestamps: true
});

// ✅ SOLO ÍNDICES BÁSICOS - SIN NINGÚN 2dsphere
orderSchema.index({ clientId: 1, status: 1 });
orderSchema.index({ mandaditoId: 1, status: 1 });
orderSchema.index({ voucherCode: 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.pre('save', function(next) {
  if (!this.voucherCode) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.voucherCode = `DV-${timestamp}-${random}`;
  }

  if (this.isModified('status')) {
    if (!this.statusHistory) this.statusHistory = [];
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      note: `Estado cambiado a ${this.status}`
    });

    if (!this.tracking) this.tracking = { updates: [] };
    this.tracking.status = this.status;
    this.tracking.updates.push({
      status: this.status,
      timestamp: new Date(),
      note: `Estado actualizado a ${this.status}`
    });
  }

  next();
});

orderSchema.methods.addNotification = async function(type, message, userId) {
  if (!this.notifications) this.notifications = [];
  this.notifications.push({
    type,
    message,
    sentTo: userId,
    sentAt: new Date(),
    read: false
  });
  return this.save();
};

orderSchema.methods.addTrackingUpdate = async function(status, location, note) {
  if (!this.tracking) this.tracking = { updates: [] };
  this.tracking.status = status;
  
  const update = {
    status,
    timestamp: new Date(),
    note: note || `Estado: ${status}`,
    updatedBy: this.mandaditoId || this.clientId
  };

  if (location && location.coordinates) {
    update.location = location.coordinates;
    this.tracking.currentLocation = location.coordinates;
    this.tracking.updatedAt = new Date();
  }

  this.tracking.updates.push(update);
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);