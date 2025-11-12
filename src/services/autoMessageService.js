const db = require('../config/database');
const Message = db.Message;
const MessageUser = db.MessageUser;
const logger = require('../utils/logger');

const WELCOME_TEMPLATE = {
  code: 'system_welcome',
  title: 'Bienvenido al Sistema',
  description: 'Tu camino empieza ahora, no mires hacia delante, ni hacia atrás, céntrate en el ahora.',
  type: 'info',
  active: true
};

async function ensureWelcomeTemplate(transaction) {
  const [message] = await Message.findOrCreate({
    where: { code: WELCOME_TEMPLATE.code },
    defaults: WELCOME_TEMPLATE,
    transaction
  });
  return message;
}

/**
 * Create and send welcome message to a new user
 * @param {number} userId - The new user's ID
 */
async function sendWelcomeMessage(userId) {
  const transaction = await db.sequelize.transaction();
  try {
    const message = await ensureWelcomeTemplate(transaction);

    await MessageUser.findOrCreate({
      where: { id_message: message.id, id_user: userId },
      defaults: { id_message: message.id, id_user: userId },
      transaction
    });

    await transaction.commit();
    return message;
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
 * Create and send reward result message to user
 * @param {number} userId - The user's ID
 * @param {string} rewardDescription - Description of the reward (e.g., "+100 EXP", "-50 EXP")
 */
async function sendRewardResultMessage(userId, rewardDescription) {
  try {
    // Create reward result message
    const message = await Message.create({
      title: 'Resultado de misión',
      description: rewardDescription,
      type: 'reward',
      active: true
    });

    // Send to user
    await MessageUser.create({
      id_message: message.id,
      id_user: userId
    });

    return message;
  } catch (error) {
    logger.error('[AutoMessageService] sendRewardResultMessage - error', { 
      userId, 
      error: error.message 
    });
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
    // Create level up message
    const message = await Message.create({
      title: `¡Nivel ${newLevel} alcanzado!`,
      description: `Enhorabuena, has subido al nivel ${newLevel}. Sigue completando misiones para seguir progresando.`,
      type: 'info',
      active: true
    });

    // Send to user
    await MessageUser.create({
      id_message: message.id,
      id_user: userId
    });

    return message;
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
  sendRewardResultMessage,
  sendLevelUpMessage
};
