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
  }]
}, {
  timestamps: true
});

orderSchema.index({ clientId: 1, status: 1 });
orderSchema.index({ mandaditoId: 1, status: 1 });
orderSchema.index({ voucherCode: 1 });
orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ deliveryLocation: '2dsphere' });
orderSchema.index({ createdAt: -1 });

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

module.exports = mongoose.model('Order', orderSchema);