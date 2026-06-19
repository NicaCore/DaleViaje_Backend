const mongoose = require('mongoose');
require('dotenv').config();
const { CreditPackage } = require('../models/CreditPackage');
const connectDB = require('../config/database');

const createPackages = async () => {
  try {
    await connectDB.connect();

    await CreditPackage.deleteMany({});
    console.log('✅ Paquetes existentes eliminados');

    const packages = [
      { name: 'Paquete Básico', credits: 10, price: 40, currency: 'Córdobas', description: '10 créditos para comenzar' },
      { name: 'Paquete Estándar', credits: 25, price: 60, currency: 'Córdobas', description: '25 créditos para mandaditos regulares' },
      { name: 'Paquete Premium', credits: 50, price: 80, currency: 'Córdobas', description: '50 créditos para mandaditos activos' },
      { name: 'Paquete Pro', credits: 100, price: 100, currency: 'Córdobas', description: '100 créditos para mandaditos profesionales' },
      { name: 'Paquete Máster', credits: 200, price: 150, currency: 'Córdobas', description: '200 créditos para mandaditos destacados' }
    ];

    for (const pkg of packages) {
      const creditPackage = new CreditPackage(pkg);
      await creditPackage.save();
      console.log(`✅ Paquete creado: ${pkg.name} - ${pkg.credits} créditos - C$${pkg.price}`);
    }

    console.log('✅ Todos los paquetes creados exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando paquetes:', error);
    process.exit(1);
  }
};

createPackages();