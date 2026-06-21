// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [50, 'El nombre no puede exceder 50 caracteres']
  },
  lastName: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
    maxlength: [50, 'El apellido no puede exceder 50 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'El teléfono es requerido'],
    trim: true,
    match: [/^[0-9]{8,15}$/, 'Teléfono inválido']
  },
  department: {
    type: String,
    default: 'Juigalpa, Chontales',
    enum: ['Juigalpa, Chontales']
  },
  role: {
    type: String,
    required: true,
    enum: Object.values(ROLES)
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  // ✅ ELIMINAMOS location y usamos un campo simple
  // En lugar de usar índices 2dsphere, usamos campos separados
  latitude: {
    type: Number,
    default: 12.0 // Juigalpa
  },
  longitude: {
    type: Number,
    default: -85.0 // Juigalpa
  },
  profilePhoto: {
    type: String,
    default: null
  },
  termsAccepted: {
    type: Boolean,
    default: false
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  locationAccess: {
    type: Boolean,
    default: false
  },
  backgroundMode: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  deviceId: {
    type: String,
    default: null
  },
  devicePlatform: {
    type: String,
    enum: ['ios', 'android', 'web', null],
    default: null
  },
  pushNotificationsEnabled: {
    type: Boolean,
    default: true
  },
  emailNotificationsEnabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ✅ Índices SIMPLES (sin 2dsphere)
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('location').get(function() {
  return {
    type: 'Point',
    coordinates: [this.longitude, this.latitude]
  };
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);