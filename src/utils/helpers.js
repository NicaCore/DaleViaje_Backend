const moment = require('moment');

const generateCode = (prefix = 'DV') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const formatDate = (date, format = 'DD/MM/YYYY HH:mm') => {
  return moment(date).format(format);
};

const isValidId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const sanitizeText = (text) => {
  if (!text) return '';
  return text.trim().replace(/[<>]/g, '');
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => {
  return /^[0-9]{8,15}$/.test(phone);
};

const formatMoney = (amount, currency = 'C$') => {
  return `${currency}${amount.toFixed(2)}`;
};

const getRelativeTime = (date) => {
  return moment(date).fromNow();
};

module.exports = {
  generateCode,
  formatDate,
  isValidId,
  sanitizeText,
  isValidEmail,
  isValidPhone,
  formatMoney,
  getRelativeTime
};