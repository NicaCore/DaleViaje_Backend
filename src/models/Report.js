const mongoose = require('mongoose');
const { REPORT_STATUS } = require('../config/constants');

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reporterRole: {
    type: String,
    enum: ['client', 'mandadito', 'business', 'admin'],
    required: true
  },
  reportedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedRole: {
    type: String,
    enum: ['client', 'mandadito', 'business'],
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  type: {
    type: String,
    enum: ['queja', 'problema', 'reporte_usuario', 'reporte_mandadito', 'otro'],
    required: true
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    maxlength: 1000
  },
  images: [{
    type: String
  }],
  status: {
    type: String,
    enum: Object.values(REPORT_STATUS),
    default: REPORT_STATUS.PENDING
  },
  adminNotes: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isResolved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

reportSchema.index({ reporterId: 1 });
reportSchema.index({ reportedId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);