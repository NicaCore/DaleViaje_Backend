const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
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
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderRole: {
      type: String,
      enum: ['client', 'mandadito', 'admin'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    images: [{
      type: String
    }],
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessage: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

chatSchema.index({ orderId: 1 });
chatSchema.index({ clientId: 1, mandaditoId: 1 });
chatSchema.index({ isActive: 1 });
chatSchema.index({ lastMessage: -1 });

chatSchema.methods.addMessage = async function(messageData) {
  const message = {
    ...messageData,
    timestamp: new Date()
  };
  
  this.messages.push(message);
  this.lastMessage = new Date();
  this.unreadCount += 1;
  
  await this.save();
  return message;
};

chatSchema.methods.markAsRead = async function(userId) {
  let count = 0;
  this.messages.forEach(msg => {
    if (msg.senderId.toString() !== userId && !msg.isRead) {
      msg.isRead = true;
      count++;
    }
  });
  
  if (count > 0) {
    this.unreadCount = Math.max(0, this.unreadCount - count);
    await this.save();
  }
  
  return count;
};

module.exports = mongoose.model('Chat', chatSchema);