const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const messageController = require('../controllers/messageController');

// POST /api/messages/load -> expects { userId }
router.post('/load', protect, messageController.loadMessages);

// POST /api/messages/mark-read -> expects { userId, messageUserId }
router.post('/mark-read', protect, messageController.markAsRead);

module.exports = router;
