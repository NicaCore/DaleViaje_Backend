// src/models/Order.js
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
  pickupLocation: {
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
  deliveryAddress: {
    type: String,
    required: [true, 'La dirección de entrega es requerida']
  },
  deliveryLocation: {
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
    unique: true,
    required: true
  },
  businessProducts: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true
    }
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
    enum: ['pending', 'approved', 'rejected'],
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
  // ========== NUEVOS CAMPOS ==========
  tracking: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    updates: [{
      status: {
        type: String,
        enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
        required: true
      },
      location: {
        coordinates: [Number],
        address: String
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      note: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    currentLocation: {
      coordinates: [Number],
      updatedAt: Date
    },
    estimatedTime: {
      type: Number,
      default: null
    },
    distanceRemaining: {
      type: Number,
      default: null
    }
  },
  notifications: [{
    type: {
      type: String,
      enum: ['order_created', 'order_accepted', 'order_in_progress', 'order_completed', 'order_cancelled', 'message', 'location_update']
    },
    message: String,
    sentTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  rating: {
    clientRating: {
      score: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      comment: String,
      ratedAt: Date
    },
    mandaditoRating: {
      score: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      comment: String,
      ratedAt: Date
    }
  }
}, {
  timestamps: true
});

// Índices
orderSchema.index({ clientId: 1, status: 1 });
orderSchema.index({ mandaditoId: 1, status: 1 });
orderSchema.index({ voucherCode: 1 });
orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ deliveryLocation: '2dsphere' });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'tracking.currentLocation': '2dsphere' });

orderSchema.pre('save', function(next) {
  if (!this.voucherCode) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.voucherCode = `DV-${timestamp}-${random}`;
  }
  
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      note: `Estado cambiado a ${this.status}`
    });
    
    // Actualizar tracking
    this.tracking.status = this.status;
    this.tracking.updates.push({
      status: this.status,
      timestamp: new Date(),
      note: `Estado actualizado a ${this.status}`
    });
  }
  
  next();
});

orderSchema.methods.canClientCancel = function() {
  return this.status === ORDER_STATUS.PENDING || 
         this.status === ORDER_STATUS.ACCEPTED;
};

orderSchema.methods.canMandaditoComplete = function() {
  return this.status === ORDER_STATUS.ACCEPTED || 
         this.status === ORDER_STATUS.IN_PROGRESS;
};

orderSchema.methods.addTrackingUpdate = async function(status, location, note) {
  this.tracking.status = status;
  this.tracking.updates.push({
    status,
    location: location || this.tracking.currentLocation,
    timestamp: new Date(),
    note: note || `Estado: ${status}`
  });
  
  if (location) {
    this.tracking.currentLocation = {
      coordinates: location.coordinates,
      updatedAt: new Date()
    };
  }
  
  return this.save();
};

orderSchema.methods.addNotification = async function(type, message, userId) {
  this.notifications.push({
    type,
    message,
    sentTo: userId,
    sentAt: new Date()
  });
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);