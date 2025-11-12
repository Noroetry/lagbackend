const messageService = require('../services/messageService');
const logger = require('../utils/logger');

/**
 * Load messages for a user
 */
async function loadMessages(req, res) {
  try {
    const userId = req.body && req.body.userId ? req.body.userId : null;
    
    if (!userId) {
      logger.warn('[MessageController] loadMessages called without userId', { body: req.body });
      return res.status(400).json({ error: 'userId is required' });
    }

    const messages = await messageService.loadMessagesForUser(userId);

    logger.info('[MessageController] loadMessages finished', { 
      userId, 
      messagesCount: messages.length
    });

    return res.status(200).json({ messages });
  } catch (err) {
    logger.error('[MessageController] Error in loadMessages:', err && err.message ? err.message : err, { 
      stack: err && err.stack ? err.stack : undefined 
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Mark a message as read
 */
async function markAsRead(req, res) {
  try {
    const userId = req.body && req.body.userId ? req.body.userId : null;
    const messageUserId = req.body && req.body.messageUserId ? req.body.messageUserId : null;

    if (!userId || !messageUserId) {
      logger.warn('[MessageController] markAsRead called without required params', { body: req.body });
      return res.status(400).json({ error: 'userId and messageUserId are required' });
    }

    logger.info('[MessageController] markAsRead called', { userId, messageUserId });

    const result = await messageService.markMessageAsRead(messageUserId, userId);

    return res.status(200).json(result);
  } catch (err) {
    logger.error('[MessageController] Error in markAsRead:', err && err.message ? err.message : err, { 
      stack: err && err.stack ? err.stack : undefined 
    });
    
    if (err.message === 'Message not found or does not belong to user') {
      return res.status(404).json({ error: err.message });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  loadMessages,
  markAsRead
};
