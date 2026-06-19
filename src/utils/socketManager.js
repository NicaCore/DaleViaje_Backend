const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

exports.initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Autenticación requerida'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Usuario no encontrado'));
      }

      socket.userId = user._id;
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.userId} (${socket.userRole})`);
    
    socket.join(`user_${socket.userId}`);

    socket.on('join_chat', (chatId) => {
      socket.join(`chat_${chatId}`);
    });

    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat_${chatId}`);
    });

    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude } = data;
        await User.findByIdAndUpdate(
          socket.userId,
          {
            location: {
              type: 'Point',
              coordinates: [longitude, latitude]
            }
          }
        );
        
        socket.broadcast.emit('user_location_updated', {
          userId: socket.userId,
          latitude,
          longitude
        });
      } catch (error) {
        console.error('Error actualizando ubicación:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.userId}`);
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io no inicializado');
  }
  return io;
};