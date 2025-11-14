const db = require('../config/database');
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
      order: [
        ['dateRead', 'ASC NULLS FIRST'],
        ['createdAt', 'DESC']
      ]
    });

    const messages = messageUsers.map(mu => {
      // Extraer questTitle de la descripción si existe
      let questTitle = null;
      if (mu.description) {
        const match = mu.description.match(/La misión "([^"]+)"/);
        if (match && match[1]) {
          questTitle = match[1];
        }
      }

      return {
        id: mu.id,
        title: mu.title,
        description: mu.description,
        questTitle: questTitle, // Título de la quest extraído de description
        type: mu.type, // 'info', 'reward' o 'penalty'
        adjunts: mu.adjunts,
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
