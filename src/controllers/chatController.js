const Chat = require('../models/Chat');
const Order = require('../models/Order');
const User = require('../models/User');
const { getImageUrl } = require('../middleware/upload');

// ============================================
// OBTENER CHATS DEL USUARIO
// ============================================

exports.getChats = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    // Buscar chats donde el usuario participe
    let filter = { isActive: true };
    
    if (userRole === 'client') {
      filter.clientId = userId;
    } else if (userRole === 'mandadito') {
      filter.mandaditoId = userId;
    } else if (userRole === 'admin') {
      // Admin puede ver todos los chats activos
    }

    const chats = await Chat.find(filter)
      .populate('clientId', 'firstName lastName email profilePhoto')
      .populate('mandaditoId', 'firstName lastName email profilePhoto')
      .populate('orderId', 'voucherCode description amount status')
      .sort({ lastMessage: -1 });

    // Formatear respuesta
    const formattedChats = chats.map(chat => {
      // Determinar el otro usuario en el chat
      let otherUser = null;
      if (userRole === 'client' && chat.mandaditoId) {
        otherUser = chat.mandaditoId;
      } else if (userRole === 'mandadito' && chat.clientId) {
        otherUser = chat.clientId;
      } else if (userRole === 'admin') {
        // Admin ve ambos
        otherUser = {
          client: chat.clientId,
          mandadito: chat.mandaditoId
        };
      }

      // Último mensaje
      const lastMessage = chat.messages.length > 0 
        ? chat.messages[chat.messages.length - 1] 
        : null;

      // Contar mensajes no leídos
      const unreadCount = chat.messages.filter(
        msg => msg.senderId.toString() !== userId && !msg.isRead
      ).length;

      return {
        id: chat._id,
        orderId: chat.orderId,
        otherUser,
        lastMessage,
        unreadCount,
        messagesCount: chat.messages.length,
        lastMessageDate: chat.lastMessage,
        isActive: chat.isActive,
        order: chat.orderId
      };
    });

    res.json({
      success: true,
      chats: formattedChats,
      total: formattedChats.length
    });

  } catch (error) {
    console.error('Error obteniendo chats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener chats'
    });
  }
};

// ============================================
// OBTENER CHAT POR ID DE ORDEN
// ============================================

exports.getChatByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    // Verificar que la orden existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    // Verificar que el usuario tenga acceso a este chat
    const isClient = order.clientId.toString() === userId;
    const isMandadito = order.mandaditoId && order.mandaditoId.toString() === userId;
    const isAdmin = req.userRole === 'admin';

    if (!isClient && !isMandadito && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este chat'
      });
    }

    // Buscar o crear chat
    let chat = await Chat.findOne({ orderId })
      .populate('clientId', 'firstName lastName email profilePhoto')
      .populate('mandaditoId', 'firstName lastName email profilePhoto');

    if (!chat) {
      // Crear chat si no existe
      chat = new Chat({
        orderId,
        clientId: order.clientId,
        mandaditoId: order.mandaditoId || null,
        isActive: true,
        messages: [],
        lastMessage: new Date()
      });
      await chat.save();

      // Actualizar la orden con el chatId
      order.chatId = chat._id;
      await order.save();

      // Volver a buscar con populados
      chat = await Chat.findById(chat._id)
        .populate('clientId', 'firstName lastName email profilePhoto')
        .populate('mandaditoId', 'firstName lastName email profilePhoto');
    }

    // Marcar mensajes como leídos (excepto los del usuario actual)
    chat.messages.forEach(msg => {
      if (msg.senderId.toString() !== userId && !msg.isRead) {
        msg.isRead = true;
      }
    });
    chat.unreadCount = 0;
    await chat.save();

    // Formatear mensajes para la respuesta
    const formattedMessages = chat.messages.filter(msg => !msg.isDeleted).map(msg => ({
      id: msg._id,
      senderId: msg.senderId,
      senderRole: msg.senderRole,
      message: msg.message,
      images: msg.images || [],
      timestamp: msg.timestamp,
      isRead: msg.isRead,
      isOwn: msg.senderId.toString() === userId
    }));

    res.json({
      success: true,
      chat: {
        id: chat._id,
        orderId: chat.orderId,
        client: chat.clientId,
        mandadito: chat.mandaditoId,
        messages: formattedMessages,
        lastMessage: chat.lastMessage,
        isActive: chat.isActive,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      },
      order: {
        id: order._id,
        voucherCode: order.voucherCode,
        description: order.description,
        amount: order.amount,
        status: order.status,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress
      }
    });

  } catch (error) {
    console.error('Error obteniendo chat por orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener chat'
    });
  }
};

// ============================================
// ENVIAR MENSAJE
// ============================================

exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;
    const { message } = req.body;

    // Buscar el chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat no encontrado'
      });
    }

    // Verificar que el usuario sea parte del chat
    const isClient = chat.clientId.toString() === userId;
    const isMandadito = chat.mandaditoId && chat.mandaditoId.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isClient && !isMandadito && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para enviar mensajes en este chat'
      });
    }

    // Verificar que el chat esté activo
    if (!chat.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Este chat está inactivo'
      });
    }

    // Verificar que el mandadito esté asignado
    if (!chat.mandaditoId && userRole === 'client') {
      // El cliente puede enviar mensajes aunque no haya mandadito asignado aún
      // Pero el mandadito no puede enviar si no está asignado
    }

    // Determinar el rol del remitente
    let senderRole = userRole;
    if (userRole === 'client') senderRole = 'client';
    else if (userRole === 'mandadito') senderRole = 'mandadito';
    else if (userRole === 'admin') senderRole = 'admin';

    // Procesar imágenes si hay
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = getImageUrl(file.filename, 'chat');
        images.push(imageUrl);
      }
    }

    // Crear el mensaje
    const messageData = {
      senderId: userId,
      senderRole,
      message: message || '📎 Imagen adjunta',
      images: images,
      timestamp: new Date(),
      isRead: false,
      isDeleted: false
    };

    // Agregar mensaje al chat
    const newMessage = await chat.addMessage(messageData);

    // Emitir mensaje via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('new_message', {
        chatId: chat._id,
        message: {
          id: newMessage._id,
          senderId: userId,
          senderRole,
          message: newMessage.message,
          images: newMessage.images,
          timestamp: newMessage.timestamp,
          isRead: newMessage.isRead
        }
      });

      // Notificar al otro usuario
      const otherUserId = isClient ? chat.mandaditoId : chat.clientId;
      if (otherUserId) {
        io.to(`user_${otherUserId}`).emit('new_chat_message', {
          chatId: chat._id,
          orderId: chat.orderId,
          message: newMessage.message,
          senderName: req.user.firstName + ' ' + req.user.lastName,
          timestamp: newMessage.timestamp
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: {
        id: newMessage._id,
        senderId: userId,
        senderRole,
        message: newMessage.message,
        images: newMessage.images,
        timestamp: newMessage.timestamp,
        isRead: newMessage.isRead
      }
    });

  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar mensaje'
    });
  }
};

// ============================================
// MARCAR MENSAJES COMO LEÍDOS
// ============================================

exports.markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat no encontrado'
      });
    }

    // Verificar que el usuario sea parte del chat
    const isClient = chat.clientId.toString() === userId;
    const isMandadito = chat.mandaditoId && chat.mandaditoId.toString() === userId;
    const isAdmin = req.userRole === 'admin';

    if (!isClient && !isMandadito && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para marcar mensajes en este chat'
      });
    }

    // Marcar mensajes como leídos
    const count = await chat.markAsRead(userId);

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('messages_read', {
        chatId: chat._id,
        userId,
        count
      });
    }

    res.json({
      success: true,
      message: 'Mensajes marcados como leídos',
      count
    });

  } catch (error) {
    console.error('Error marcando mensajes como leídos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar mensajes como leídos'
    });
  }
};

// ============================================
// ELIMINAR MENSAJE (soft delete)
// ============================================

exports.deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.userId;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat no encontrado'
      });
    }

    // Verificar que el usuario sea parte del chat
    const isClient = chat.clientId.toString() === userId;
    const isMandadito = chat.mandaditoId && chat.mandaditoId.toString() === userId;
    const isAdmin = req.userRole === 'admin';

    if (!isClient && !isMandadito && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar mensajes en este chat'
      });
    }

    // Buscar el mensaje
    const messageIndex = chat.messages.findIndex(
      msg => msg._id.toString() === messageId
    );

    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }

    const message = chat.messages[messageIndex];

    // Verificar que el usuario sea el dueño del mensaje o admin
    if (message.senderId.toString() !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este mensaje'
      });
    }

    // Soft delete - marcar como eliminado
    message.isDeleted = true;
    await chat.save();

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('message_deleted', {
        chatId: chat._id,
        messageId,
        userId
      });
    }

    res.json({
      success: true,
      message: 'Mensaje eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar mensaje'
    });
  }
};

// ============================================
// DESACTIVAR CHAT
// ============================================

exports.deactivateChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat no encontrado'
      });
    }

    // Solo admin puede desactivar chats
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para desactivar chats'
      });
    }

    chat.isActive = false;
    await chat.save();

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('chat_deactivated', {
        chatId: chat._id
      });
    }

    res.json({
      success: true,
      message: 'Chat desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error desactivando chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar chat'
    });
  }
};

// ============================================
// OBTENER MENSAJES NO LEÍDOS (contador)
// ============================================

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    let filter = { isActive: true };
    
    if (userRole === 'client') {
      filter.clientId = userId;
    } else if (userRole === 'mandadito') {
      filter.mandaditoId = userId;
    } else if (userRole === 'admin') {
      // Admin ve todos los mensajes no leídos
    }

    const chats = await Chat.find(filter);

    let totalUnread = 0;
    const chatUnreadCounts = [];

    for (const chat of chats) {
      const unreadCount = chat.messages.filter(
        msg => msg.senderId.toString() !== userId && !msg.isRead
      ).length;
      
      if (unreadCount > 0) {
        totalUnread += unreadCount;
        chatUnreadCounts.push({
          chatId: chat._id,
          orderId: chat.orderId,
          unreadCount
        });
      }
    }

    res.json({
      success: true,
      totalUnread,
      chats: chatUnreadCounts
    });

  } catch (error) {
    console.error('Error obteniendo mensajes no leídos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes no leídos'
    });
  }
};