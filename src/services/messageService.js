const db = require('../config/database');
const Message = db.Message;
const MessageUser = db.MessageUser;
const logger = require('../utils/logger');

/**
 * Load messages for a specific user
 * Returns an array of messages
 * @param {number} userId
 */
async function loadMessagesForUser(userId) {
  try {
    const messageUsers = await MessageUser.findAll({
      where: { 
        id_user: userId,
        deleted: false 
      },
      include: [{
        model: Message,
        as: 'message',
        where: { active: true },
        required: true
      }],
      order: [
        ['dateRead', 'ASC NULLS FIRST'],
        ['createdAt', 'DESC']
      ]
    });

    const messages = messageUsers.map(mu => {
      const msg = mu.message;
      return {
        id: mu.id,
        messageId: msg.id,
        title: msg.title,
        description: msg.description,
        type: msg.type,
        dateRead: mu.dateRead,
        isRead: !!mu.dateRead,
        createdAt: mu.createdAt
      };
    });

    return messages;
  } catch (error) {
    logger.error('[MessageService] loadMessagesForUser - error', { userId, error: error.message });
    throw error;
  }
}

/**
 * Mark a message as read for a user
 * @param {number} messageUserId
 * @param {number} userId - For validation
 */
async function markMessageAsRead(messageUserId, userId) {
  try {
    const messageUser = await MessageUser.findOne({
      where: { 
        id: messageUserId,
        id_user: userId 
      }
    });

    if (!messageUser) {
      throw new Error('Message not found or does not belong to user');
    }

    if (messageUser.dateRead) {
      return { success: true, alreadyRead: true };
    }

    messageUser.dateRead = new Date();
    await messageUser.save();

    logger.info(`Usuario lee mensaje ID ${messageUserId}`);

    return { success: true, alreadyRead: false };
  } catch (error) {
    logger.error('[MessageService] markMessageAsRead - error', { messageUserId, userId, error: error.message });
    throw error;
  }
}

module.exports = {
  loadMessagesForUser,
  markMessageAsRead
};
