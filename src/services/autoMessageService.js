const db = require('../config/database');
const MessageUser = db.MessageUser;
const logger = require('../utils/logger');

const WELCOME_MESSAGE = {
  type: 'info',
  title: 'Bienvenido al Sistema',
  description: 'Tu camino empieza ahora, no mires hacia delante, ni hacia atrás, céntrate en el ahora.'
};

/**
 * Create and send welcome message to a new user
 * @param {number} userId - The new user's ID
 */
async function sendWelcomeMessage(userId) {
  const transaction = await db.sequelize.transaction();
  try {
    await MessageUser.findOrCreate({
      where: { id_user: userId, type: 'info', title: WELCOME_MESSAGE.title },
      defaults: { 
        id_user: userId,
        type: WELCOME_MESSAGE.type,
        title: WELCOME_MESSAGE.title,
        description: WELCOME_MESSAGE.description,
        adjunts: null
      },
      transaction
    });

    await transaction.commit();
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      logger.error('[AutoMessageService] sendWelcomeMessage - rollback error', { userId, error: rollbackError.message });
    }
    logger.error('[AutoMessageService] sendWelcomeMessage - error', { userId, error: error.message });
    throw error;
  }
}

/**
 * Create and send level up message to user
 * @param {number} userId - The user's ID
 * @param {number} newLevel - The new level achieved
 */
async function sendLevelUpMessage(userId, newLevel) {
  try {
    // Crear message_user directamente con type info
    await MessageUser.create({
      id_user: userId,
      type: 'info',
      title: `¡Nivel ${newLevel} alcanzado!`,
      description: `Enhorabuena, has subido al nivel ${newLevel}. Sigue completando misiones para seguir progresando.`,
      adjunts: null
    });

  } catch (error) {
    logger.error('[AutoMessageService] sendLevelUpMessage - error', { 
      userId, 
      newLevel,
      error: error.message 
    });
    throw error;
  }
}

module.exports = {
  sendWelcomeMessage,
  sendLevelUpMessage
};
