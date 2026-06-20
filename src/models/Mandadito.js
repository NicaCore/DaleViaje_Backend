// src/models/Mandadito.js
const mongoose = require('mongoose');
const { DAYS } = require('../config/constants');

const mandaditoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  workDays: [{
    type: String,
    enum: Object.values(DAYS),
    required: true
  }],
  restDays: [{
    type: String,
    enum: Object.values(DAYS)
  }],
  schedule: {
    start: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido']
    },
    end: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido']
    }
  },
  lunchTime: {
    start: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido']
    },
    end: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido']
    }
  },
  vehiclePhoto: {
    type: String,
    required: true
  },
  licensePhoto: {
    type: String,
    required: true
  },
  cedulaPhoto: {
    type: String,
    required: true
  },
  credits: {
    type: Number,
    default: 0,
    min: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  activeOrders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  maxActiveOrders: {
    type: Number,
    default: 2
  },
  earnings: {
    type: Number,
    default: 0
  },
  deliveryHistory: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    date: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true
    },
    creditsDeducted: {
      type: Number,
      required: true
    },
    distance: {
      type: Number,
      required: true
    }
  }],
  // ========== NUEVOS CAMPOS ==========
  stats: {
    totalEarnings: {
      type: Number,
      default: 0
    },
    weeklyEarnings: {
      type: Number,
      default: 0
    },
    monthlyEarnings: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    totalCancelled: {
      type: Number,
      default: 0
    },
    totalDistance: {
      type: Number,
      default: 0
    }
  },
  availability: {
    isOnline: {
      type: Boolean,
      default: false
    },
    lastOnline: {
      type: Date,
      default: null
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    currentLocation: {
      coordinates: [Number],
      updatedAt: Date
    }
  }
}, {
  timestamps: true
});

// Índices
mandaditoSchema.index({ userId: 1 });
mandaditoSchema.index({ isFeatured: -1 });
mandaditoSchema.index({ rating: -1 });
mandaditoSchema.index({ totalDeliveries: -1 });
mandaditoSchema.index({ 'availability.currentLocation': '2dsphere' });

mandaditoSchema.methods.canAcceptMoreOrders = function() {
  return this.activeOrders.length < this.maxActiveOrders;
};

mandaditoSchema.methods.hasEnoughCredits = function(requiredCredits = 5) {
  return this.credits >= requiredCredits;
};

mandaditoSchema.methods.deductCredits = async function(amount = 5) {
  if (this.credits < amount) {
    throw new Error('Créditos insuficientes');
  }
  this.credits -= amount;
  return this.save();
};

mandaditoSchema.methods.addCredits = async function(amount) {
  this.credits += amount;
  
  // Actualizar featured si tiene 150+ créditos
  if (this.credits >= 150) {
    this.isFeatured = true;
  }
  
  return this.save();
};

mandaditoSchema.methods.updateStats = async function(orderAmount, distance) {
  this.totalDeliveries += 1;
  this.earnings += orderAmount;
  
  // Actualizar estadísticas
  this.stats.totalEarnings += orderAmount;
  this.stats.totalDistance += distance;
  
  // Calcular completion rate
  const completed = this.deliveryHistory.filter(d => d.orderId).length;
  const total = this.totalDeliveries + this.stats.totalCancelled;
  this.stats.completionRate = total > 0 ? (completed / total) * 100 : 0;
  
  return this.save();
};

mandaditoSchema.methods.updateAvailability = async function(isOnline, location) {
  this.availability.isOnline = isOnline;
  this.availability.lastOnline = new Date();
  
  if (location) {
    this.availability.currentLocation = {
      coordinates: location.coordinates,
      updatedAt: new Date()
    };
  }
  
  return this.save();
};

module.exports = mongoose.model('Mandadito', mandaditoSchema);