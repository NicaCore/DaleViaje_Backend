const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const connectDB = require('../config/database');

const createAdmin = async () => {
  try {
    await connectDB.connect();

    const existingAdmin = await User.findOne({ email: 'admin@daleviaje.com' });
    if (existingAdmin) {
      console.log('⚠️ El admin ya existe');
      process.exit(0);
    }

    const admin = new User({
      firstName: 'Admin',
      lastName: 'DaleViaje',
      email: 'admin@daleviaje.com',
      password: 'Admin123456',
      phone: '88888888',
      role: 'admin',
      department: 'Juigalpa, Chontales',
      isActive: true,
      termsAccepted: true,
      notificationsEnabled: true,
      locationAccess: true,
      backgroundMode: true
    });

    await admin.save();
    console.log('✅ Admin creado exitosamente');
    console.log('📧 Email: admin@daleviaje.com');
    console.log('🔑 Contraseña: Admin123456');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando admin:', error);
    process.exit(1);
  }
};

createAdmin();