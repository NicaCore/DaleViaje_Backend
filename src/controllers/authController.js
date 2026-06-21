const User = require('../models/User');
const Client = require('../models/Client');
const Mandadito = require('../models/Mandadito');
const Business = require('../models/Business');
const jwt = require('jsonwebtoken');
const { getImageUrl } = require('../middleware/upload');

// Registrar usuario - CORREGIDO
exports.register = async (req, res) => {
  try {
    console.log('📝 Body recibido:', req.body);
    
    const { 
      firstName, lastName, email, password, phone, 
      role, termsAccepted, ...additionalData 
    } = req.body;

    // Validar campos obligatorios
    if (!firstName || !lastName || !email || !password || !phone || !role) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // ✅ Datos base del usuario con ubicación por defecto
    const userData = {
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      department: 'Juigalpa, Chontales',
      termsAccepted: termsAccepted === 'true' || termsAccepted === true || false,
      locationAccess: false,
      notificationsEnabled: true,
      backgroundMode: true,
      location: {
        type: 'Point',
        coordinates: [-85.0, 12.0]
      }
    };

    // ✅ SOLO CLIENTE: foto de perfil es OPCIONAL
    if (role === 'client') {
      if (req.file) {
        userData.profilePhoto = getImageUrl(req.file.filename, 'profiles');
      } else if (req.files && req.files.profilePhoto) {
        const file = req.files.profilePhoto;
        if (file && file[0]) {
          userData.profilePhoto = getImageUrl(file[0].filename, 'profiles');
        }
      }
    }

    console.log('👤 Datos de usuario a guardar:', { ...userData, password: '******' });

    const user = new User(userData);
    await user.save();
    console.log('✅ Usuario guardado:', user._id);

    let profile = null;
    let profileData = {};

    // ========== CLIENTE ==========
    if (role === 'client') {
      profile = new Client({ userId: user._id });
      await profile.save();
      profileData = profile;
      console.log('✅ Perfil de cliente guardado');
    } 
    
    // ========== MANDADITO ==========
    else if (role === 'mandadito') {
      // Parsear datos adicionales
      let workDays = [];
      let restDays = [];
      let schedule = { start: '08:00', end: '18:00' };
      let lunchTime = { start: '12:00', end: '13:00' };

      try {
        workDays = additionalData.workDays ? JSON.parse(additionalData.workDays) : [];
        restDays = additionalData.restDays ? JSON.parse(additionalData.restDays) : [];
        schedule = additionalData.schedule ? JSON.parse(additionalData.schedule) : { start: '08:00', end: '18:00' };
        lunchTime = additionalData.lunchTime ? JSON.parse(additionalData.lunchTime) : { start: '12:00', end: '13:00' };
      } catch (e) {
        console.warn('⚠️ Error parseando datos del mandadito:', e.message);
      }
      
      // ✅ Mandadito: Verificar documentos requeridos
      const hasVehiclePhoto = req.files && req.files.vehiclePhoto && req.files.vehiclePhoto[0];
      const hasLicensePhoto = req.files && req.files.licensePhoto && req.files.licensePhoto[0];
      const hasCedulaPhoto = req.files && req.files.cedulaPhoto && req.files.cedulaPhoto[0];

      if (!hasVehiclePhoto || !hasLicensePhoto || !hasCedulaPhoto) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message: 'Faltan documentos requeridos para registro como mandadito: vehiclePhoto, licensePhoto, cedulaPhoto'
        });
      }

      // ✅ Mandadito: foto de perfil REQUERIDA
      let profilePhotoUrl = null;
      if (req.files && req.files.profilePhoto && req.files.profilePhoto[0]) {
        profilePhotoUrl = getImageUrl(req.files.profilePhoto[0].filename, 'profiles');
      }

      profile = new Mandadito({
        userId: user._id,
        profilePhoto: profilePhotoUrl,
        workDays,
        restDays,
        schedule,
        lunchTime,
        vehiclePhoto: getImageUrl(req.files.vehiclePhoto[0].filename, 'vehicles'),
        licensePhoto: getImageUrl(req.files.licensePhoto[0].filename, 'licenses'),
        cedulaPhoto: getImageUrl(req.files.cedulaPhoto[0].filename, 'ids'),
        credits: 0,
        isVerified: false
      });
      await profile.save();
      profileData = profile;
      console.log('✅ Perfil de mandadito guardado');
    } 
    
    // ========== NEGOCIO ==========
    else if (role === 'business') {
      let businessName = additionalData.businessName || '';
      let businessType = additionalData.businessType || '';
      let description = additionalData.description || '';
      let address = additionalData.address || '';
      let location = { coordinates: [-85.0, 12.0] };

      try {
        location = additionalData.location ? JSON.parse(additionalData.location) : { coordinates: [-85.0, 12.0] };
      } catch (e) {
        console.warn('⚠️ Error parseando ubicación del negocio:', e.message);
      }
      
      // ✅ Negocio: Verificar documentos requeridos
      const hasBusinessPhoto = req.files && req.files.businessPhoto && req.files.businessPhoto[0];
      const hasPaymentReceipt = req.files && req.files.paymentReceipt && req.files.paymentReceipt[0];

      if (!hasBusinessPhoto || !hasPaymentReceipt) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message: 'Faltan documentos requeridos para registro como negocio: businessPhoto, paymentReceipt'
        });
      }

      // Generar referencia de pago
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const paymentReference = `NEG-${timestamp}-${random}`;

      profile = new Business({
        userId: user._id,
        businessName,
        businessType,
        description,
        address,
        location,
        profilePhoto: getImageUrl(req.files.businessPhoto[0].filename, 'businesses'),
        paymentReceipt: getImageUrl(req.files.paymentReceipt[0].filename, 'receipts'),
        paymentStatus: 'pending',
        isApproved: false,
        paymentReference
      });
      await profile.save();
      profileData = profile;
      console.log('✅ Perfil de negocio guardado');

      // Información de pago
      const paymentInfo = {
        phone: process.env.ADMIN_PHONE || '88888888',
        bank: process.env.ADMIN_BANK_NAME || 'BANPRO',
        account: process.env.ADMIN_ACCOUNT_NUMBER || '123456789',
        accountType: process.env.ADMIN_ACCOUNT_TYPE || 'Ahorro',
        amount: 4,
        currency: 'USD',
        reference: paymentReference,
        message: 'Realiza el pago de $4 USD a nuestra billetera móvil y sube el comprobante para activar tu negocio.'
      };

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      return res.status(201).json({
        success: true,
        message: '✅ Negocio registrado exitosamente.',
        paymentInfo,
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          profilePhoto: user.profilePhoto,
          isActive: user.isActive
        },
        business: profile
      });
    }

    // Generar token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        profilePhoto: user.profilePhoto,
        isActive: user.isActive
      },
      profile: profileData
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    console.error('📋 Stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Iniciar sesión - CORREGIDO
exports.login = async (req, res) => {
  try {
    console.log('🔐 Intento de login:', req.body.email);

    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Usuario bloqueado'
      });
    }

    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `No tienes permisos como ${role}`
      });
    }

    let profile = null;
    let profileData = {};

    if (user.role === 'client') {
      profile = await Client.findOne({ userId: user._id });
      profileData = profile || {};
    } else if (user.role === 'mandadito') {
      profile = await Mandadito.findOne({ userId: user._id });
      profileData = profile || {};
      
      if (profile && profile.credits >= 150) {
        profile.isFeatured = true;
        await profile.save();
      }
    } else if (user.role === 'business') {
      profile = await Business.findOne({ userId: user._id });
      profileData = profile || {};
      
      if (profile) {
        if (!profile.isApproved) {
          return res.status(403).json({
            success: false,
            message: 'Tu cuenta de negocio está pendiente de aprobación.'
          });
        }
        if (!profile.isActive) {
          return res.status(403).json({
            success: false,
            message: 'Tu cuenta de negocio está inactiva'
          });
        }
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('✅ Login exitoso:', user.email);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        profilePhoto: user.profilePhoto,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        lastLogin: user.lastLogin
      },
      profile: profileData
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    console.error('📋 Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Actualizar perfil
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const updates = req.body;
    
    const forbiddenUpdates = ['_id', 'email', 'role', 'password', 'createdAt', 'updatedAt'];
    forbiddenUpdates.forEach(field => delete updates[field]);

    if (req.file) {
      updates.profilePhoto = getImageUrl(req.file.filename, 'profiles');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        profilePhoto: user.profilePhoto,
        isActive: user.isActive,
        notificationsEnabled: user.notificationsEnabled,
        locationAccess: user.locationAccess,
        backgroundMode: user.backgroundMode
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
};

// Actualizar ubicación
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.userId;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas requeridas'
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas inválidas'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        locationAccess: true
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('user_location_updated', {
        userId: user._id,
        latitude,
        longitude,
        role: user.role
      });
    }

    res.json({
      success: true,
      message: 'Ubicación actualizada',
      location: user.location
    });

  } catch (error) {
    console.error('❌ Error actualizando ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar ubicación'
    });
  }
};

// Cerrar sesión
exports.logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión'
    });
  }
};