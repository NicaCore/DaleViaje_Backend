const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getChatByOrder,
  sendMessage,
  markAsRead
} = require('../controllers/chatController');

router.get('/order/:orderId', auth, getChatByOrder);
router.post('/:chatId/message', auth, upload.array('images', 2), sendMessage);
router.put('/:chatId/read', auth, markAsRead);

module.exports = router;