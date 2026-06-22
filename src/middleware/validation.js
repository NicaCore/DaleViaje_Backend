// src/middleware/validation.js - CON validateOrder COMENTADO
const { body, validationResult } = require('express-validator');

const validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

const validateRegister = [
  body('firstName')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúñÑ\s]+$/).withMessage('El nombre solo puede contener letras'),

  body('lastName')
    .notEmpty().withMessage('El apellido es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúñÑ\s]+$/).withMessage('El apellido solo puede contener letras'),

  body('email')
    .notEmpty().withMessage('El email es requerido')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),

  body('phone')
    .notEmpty().withMessage('El teléfono es requerido')
    .matches(/^[0-9]{8,15}$/).withMessage('Teléfono inválido (8-15 dígitos)'),

  body('role')
    .notEmpty().withMessage('El rol es requerido')
    .isIn(['client', 'mandadito', 'business']).withMessage('Rol inválido'),

  body('termsAccepted')
    .isBoolean().withMessage('termsAccepted debe ser booleano')
    .equals('true').withMessage('Debes aceptar los términos y condiciones'),

  validateResult
];

const validateLogin = [
  body('email')
    .notEmpty().withMessage('El email es requerido')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida'),

  validateResult
];

// ✅ COMENTADO - La validación se hace en el controlador
// const validateOrder = [
//   body('description')
//     .notEmpty().withMessage('La descripción es requerida')
//     .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),
//   body('pickupAddress')
//     .notEmpty().withMessage('La dirección de recogida es requerida'),
//   body('deliveryAddress')
//     .notEmpty().withMessage('La dirección de entrega es requerida'),
//   validateResult
// ];

const validateBusiness = [
  body('businessName')
    .notEmpty().withMessage('El nombre del negocio es requerido')
    .isLength({ max: 100 }).withMessage('El nombre no puede exceder 100 caracteres'),

  body('businessType')
    .notEmpty().withMessage('El tipo de negocio es requerido')
    .isIn(['comidas_rapidas', 'tienda_ropa', 'supermercado', 'farmacia', 'otros'])
    .withMessage('Tipo de negocio inválido'),

  body('description')
    .notEmpty().withMessage('La descripción es requerida')
    .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),

  body('address')
    .notEmpty().withMessage('La dirección es requerida'),

  body('location.coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('Coordenadas inválidas'),

  validateResult
];

module.exports = {
  validateResult,
  validateRegister,
  validateLogin,
  // validateOrder, // ✅ COMENTADO
  validateBusiness
};