const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const messageController = require('../controllers/messageController');
const { sendMessageValidator, changeStateValidator } = require('../middlewares/validators');

router.post('/send', protect, sendMessageValidator, messageController.sendMessage);
router.get('/inbox', protect, messageController.inbox);
router.get('/sent', protect, messageController.sent);
router.get('/:id', protect, messageController.getMessage);
router.patch('/:id/read', protect, messageController.markRead);
router.patch('/:id/state', protect, changeStateValidator, messageController.changeState);
router.delete('/:id', protect, (req, res) => {
  // soft delete via changeState
  req.body = { state: 'D' };
  return messageController.changeState(req, res);
});

module.exports = router;
