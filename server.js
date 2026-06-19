require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const path = require('path');

const connectDB = require('./src/config/database');
const { initializeSocket } = require('./src/utils/socketManager');
const errorHandler = require('./src/middleware/errorHandler');
const routes = require('./src/routes');

const app = express();
const server = http.createServer(app);

// Conectar a MongoDB
connectDB.connect();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io
const io = initializeSocket(server);
app.set('io', io);

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Rutas
app.use('/api', routes);

// Ruta de salud para Render
app.get('/', (req, res) => {
  res.json({
    name: 'Dale Viaje API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Health check para Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Puerto
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Dale Viaje API`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Estado: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Cerrando servidor...');
  server.close(async () => {
    await connectDB.disconnect();
    process.exit(0);
  });
  setTimeout(() => {
    console.error('⚠️ Forzando cierre');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, server, io };