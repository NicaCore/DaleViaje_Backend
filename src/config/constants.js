module.exports = {
  ROLES: {
    CLIENT: 'client',
    MANDADITO: 'mandadito',
    BUSINESS: 'business',
    ADMIN: 'admin'
  },

  ORDER_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  ORDER_TYPES: {
    PUBLIC: 'public',
    ASSIGNED: 'assigned',
    BUSINESS: 'business'
  },

  BUSINESS_TYPES: {
    COMIDAS_RAPIDAS: 'comidas_rapidas',
    TIENDA_ROPA: 'tienda_ropa',
    SUPERMERCADO: 'supermercado',
    FARMACIA: 'farmacia',
    OTROS: 'otros'
  },

  PAYMENT_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  REPORT_STATUS: {
    PENDING: 'pending',
    REVIEWING: 'reviewing',
    RESOLVED: 'resolved',
    REJECTED: 'rejected'
  },

  DAYS: {
    LUNES: 'Lunes',
    MARTES: 'Martes',
    MIERCOLES: 'Miércoles',
    JUEVES: 'Jueves',
    VIERNES: 'Viernes',
    SABADO: 'Sábado',
    DOMINGO: 'Domingo'
  },

  RATES: [
    { maxDistance: 1, price: 30 },
    { maxDistance: 2, price: 40 },
    { maxDistance: 3, price: 50 },
    { maxDistance: 5, price: 60 },
    { maxDistance: 8, price: 70 },
    { maxDistance: Infinity, price: 80 }
  ],

  MAX_ACTIVE_ORDERS: 2,
  CREDITS_PER_ORDER: 5,
  FEATURED_CREDITS: 150,
  MAX_CHAT_IMAGES: 2,
  MAX_PRODUCT_IMAGES: 4,

  DEPARTMENTS: ['Juigalpa', 'Chontales']
};