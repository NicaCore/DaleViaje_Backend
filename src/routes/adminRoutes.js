const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const {
  getDashboardStats,
  getUsers,
  blockUser,
  unblockUser,
  getBusinesses,
  approveBusiness,
  rejectBusiness,
  getCreditPurchases,
  approveCreditPurchase,
  rejectCreditPurchase,
  getOrders,
  getReports,
  resolveReport,
  createCreditPackage,
  updateCreditPackage,
  deleteCreditPackage
} = require('../controllers/adminController');

router.use(auth, checkRole(['admin']));

router.get('/dashboard/stats', getDashboardStats);
router.get('/users', getUsers);
router.put('/users/:userId/block', blockUser);
router.put('/users/:userId/unblock', unblockUser);
router.get('/businesses', getBusinesses);
router.put('/businesses/:businessId/approve', approveBusiness);
router.put('/businesses/:businessId/reject', rejectBusiness);
router.get('/credit-purchases', getCreditPurchases);
router.put('/credit-purchases/:purchaseId/approve', approveCreditPurchase);
router.put('/credit-purchases/:purchaseId/reject', rejectCreditPurchase);
router.get('/orders', getOrders);
router.get('/reports', getReports);
router.put('/reports/:reportId/resolve', resolveReport);
router.post('/credit-packages', createCreditPackage);
router.put('/credit-packages/:packageId', updateCreditPackage);
router.delete('/credit-packages/:packageId', deleteCreditPackage);

module.exports = router;