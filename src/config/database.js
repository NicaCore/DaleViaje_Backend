const mongoose = require('mongoose');

class Database {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      console.log('✅ MongoDB ya está conectado');
      return;
    }

    try {
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      };

      await mongoose.connect(process.env.MONGODB_URI, options);
      this.isConnected = true;
      
      console.log('✅ MongoDB conectado exitosamente');
      
      mongoose.connection.on('error', (err) => {
        console.error('❌ Error en MongoDB:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB desconectado');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    if (!this.isConnected) return;
    
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('✅ MongoDB desconectado correctamente');
    } catch (error) {
      console.error('❌ Error desconectando MongoDB:', error);
    }
  }
}

module.exports = new Database();