const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getPackages,
  purchaseCredits,
  getPurchaseHistory,
  getCreditsBalance
} = require('../controllers/creditController');

router.get('/packages', getPackages);
router.post('/purchase', auth, checkRole(['mandadito']), upload.single('paymentReceipt'), purchaseCredits);
router.get('/history', auth, checkRole(['mandadito']), getPurchaseHistory);
router.get('/balance', auth, checkRole(['mandadito']), getCreditsBalance);

module.exports = router;