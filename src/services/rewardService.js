const db = require('../config/database');
const QuestsUser = db.QuestsUser;
const QuestsObject = db.QuestsObject;
const ObjectItem = db.ObjectItem;
const QuestsHeader = db.QuestsHeader;
const User = db.User;
const UsersLevel = db.UsersLevel;
const MessageUser = db.MessageUser;
const Sequelize = db.Sequelize;
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const autoMessageService = require('./autoMessageService');

/**
 * Process rewards/penalties for a QuestsUser instance.
 * - Validates rewardDelivered is false before proceeding.
 * - Fetches quests_objects filtered by quest id and by type depending on questUser.state
 *   (state 'C' => type 'R', state 'E' => type 'P').
 * - Applies effects based on object type: experience, coin, or quest.
 * - Marks questUser.rewardDelivered = true and persists.
 * - Sends informative message with all rewards/penalties.
 *
 * @param {QuestsUser} questUser
 * @param {Transaction|null} transaction
 */
async function processQuestRewards(questUser, transaction = null) {
  if (!questUser) throw new Error('questUser is required');

  const externalTx = !!transaction;
  const t = transaction || await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    const qu = await QuestsUser.findOne({ where: { id: questUser.id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!qu) throw new Error('QuestsUser not found');

    if (qu.rewardDelivered) {
      if (!externalTx) await t.commit();
      return qu;
    }

    let wantedType = null;
    let isReward = false;
    if (qu.state === 'C') {
      wantedType = 'R';
      isReward = true;
    } else if (qu.state === 'E') {
      wantedType = 'P';
      isReward = false;
    } else {
      if (!externalTx) await t.commit();
      return qu;
    }

    // Obtener quest header para el título del mensaje
    const questHeader = await QuestsHeader.findByPk(qu.idQuest, { transaction: t });
    const questTitle = questHeader ? questHeader.title : 'Misión desconocida';

    const qObjects = await QuestsObject.findAll({ 
      where: { idQuest: qu.idQuest, type: wantedType }, 
      transaction: t 
    });
    
    const user = await User.findByPk(qu.idUser, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('User not found');

    const applied = [];
    const messageAdjunts = [];

    for (const qo of qObjects) {
      const item = await ObjectItem.findByPk(qo.idObject, { transaction: t });
      if (!item) {
        logger.warn(`[RewardService] ObjectItem ${qo.idObject} no encontrado`);
        continue;
      }

      const itemType = (item.type || '').toLowerCase();
      const quantity = Number(qo.quantity) || 0;
      const absQty = Math.round(Math.abs(quantity));

      // Determinar la cantidad real según sea recompensa o penalización
      const actualDelta = isReward ? absQty : -absQty;

      try {
        if (itemType === 'experience' || itemType === 'experiencie') {
          await applyExperience(user, actualDelta, t);
          applied.push({ 
            type: 'experience', 
            quantity: absQty, 
            signedDelta: actualDelta, 
            idObject: item.id, 
            appliedAs: wantedType 
          });

          messageAdjunts.push({
            id: item.id,
            objectName: item.objectName,
            shortName: item.shortName || 'EXP',
            description: item.description,
            type: item.type,
            quantity: actualDelta
          });

          const action = isReward ? 'gana' : 'pierde';
          logger.info(`Usuario ${action} ${absQty} EXP`);

        } else if (itemType === 'coin') {
          await applyCoins(user, actualDelta, t);
          applied.push({ 
            type: 'coin', 
            quantity: absQty, 
            signedDelta: actualDelta, 
            idObject: item.id, 
            appliedAs: wantedType 
          });

          messageAdjunts.push({
            id: item.id,
            objectName: item.objectName,
            shortName: item.shortName || 'COIN',
            description: item.description,
            type: item.type,
            quantity: actualDelta
          });

          const action = isReward ? 'gana' : 'pierde';
          logger.info(`Usuario ${action} ${absQty} monedas`);

        } else if (itemType === 'quest') {
          // Solo asignamos quests como recompensa, nunca como penalización
          if (!qo.id_quest_header) {
            logger.warn(`[RewardService] Recompensa tipo quest sin id_quest_header definido (idObject: ${item.id})`);
            throw new Error(`Recompensa tipo quest sin id_quest_header definido (idObject: ${item.id})`);
          }
          
          if (isReward) {
            const assignResult = await applyQuestReward(user.id, qo.id_quest_header, t);
            if (assignResult.assigned) {
              applied.push({ 
                type: 'quest', 
                idQuestAssigned: qo.id_quest_header,
                questTitle: assignResult.questTitle,
                idObject: item.id, 
                appliedAs: wantedType 
              });

              messageAdjunts.push({
                id: item.id,
                objectName: item.objectName,
                shortName: item.shortName || 'QUEST',
                description: item.description,
                type: item.type,
                quantity: 1,
                questAssignedTitle: assignResult.questTitle,
                idQuestAssigned: qo.id_quest_header
              });

              logger.info(`Usuario recibe misión "${assignResult.questTitle}"`);
            }
          } else {
            logger.warn(`[RewardService] No se aplican quests como penalización`);
          }

        } else {
          logger.warn(`[RewardService] Tipo de objeto no manejado: ${itemType}`);
          applied.push({ 
            type: item.type, 
            quantity, 
            idObject: item.id, 
            appliedAs: wantedType, 
            note: 'unhandled-type' 
          });
        }
      } catch (error) {
        logger.error(`[RewardService] Error aplicando ${itemType}`, { error: error.message });
        throw error;
      }
    }

    // Marcar rewardDelivered DESPUÉS de aplicar todas las recompensas al usuario
    // pero ANTES del mensaje (el mensaje es solo informativo)
    qu.rewardDelivered = true;
    await qu.save({ transaction: t });

    // Verificar subida de nivel si ganó experiencia
    const expReward = applied.find(a => a.type === 'experience' && a.signedDelta > 0);
    if (expReward) {
      try {
        await checkAndNotifyLevelUp(user.id, t);
      } catch (err) {
        logger.error('[RewardService] Error en checkAndNotifyLevelUp', { error: err.message });
      }
    }

    // Crear mensaje informativo DESPUÉS de que las recompensas ya están aplicadas
    // Si falla el mensaje, no afecta a las recompensas ya entregadas
    if (applied.length > 0) {
      try {
        await createRewardMessage(user.id, questTitle, messageAdjunts, isReward, t);
      } catch (err) {
        logger.error('[RewardService] Error creando mensaje de recompensa', { error: err.message });
        // No lanzamos el error porque las recompensas ya están aplicadas
      }
    }

    if (!externalTx) await t.commit();
    return { questUser: qu, applied, messageAdjunts };
  } catch (e) {
    try { 
      if (!externalTx) await t.rollback(); 
    } catch (er) { 
      logger.error('[RewardService] Rollback failed', { error: er.message }); 
    }
    logger.error('[RewardService] Error procesando recompensas', { error: e.message });
    throw e;
  }
}

/**
 * Apply experience to user
 */
async function applyExperience(user, delta, transaction) {
  await db.sequelize.query(
    'UPDATE "users" SET "totalExp" = GREATEST(0, "totalExp" + :delta) WHERE "id" = :id',
    { 
      transaction, 
      replacements: { delta, id: user.id }, 
      type: Sequelize.QueryTypes.UPDATE 
    }
  );
}

/**
 * Apply coins to user
 */
async function applyCoins(user, delta, transaction) {
  await db.sequelize.query(
    'UPDATE "users" SET "coins" = GREATEST(0, "coins" + :delta) WHERE "id" = :id',
    { 
      transaction, 
      replacements: { delta, id: user.id }, 
      type: Sequelize.QueryTypes.UPDATE 
    }
  );
}

/**
 * Assign a quest to user as reward
 * Only assigns quests with period 'U' (unique/single quests)
 */
async function applyQuestReward(userId, questHeaderId, transaction) {
  const questHeader = await QuestsHeader.findByPk(questHeaderId, { transaction });
  
  if (!questHeader) {
    logger.warn(`[RewardService] QuestHeader ${questHeaderId} no encontrado`);
    return { assigned: false };
  }

  // Verificar que sea period 'U' (único)
  if (questHeader.period !== 'U') {
    logger.warn(`[RewardService] Quest ${questHeaderId} no es de tipo único (period: ${questHeader.period})`);
    return { assigned: false, questTitle: questHeader.title };
  }

  // Verificar si el usuario ya tiene esta quest
  const existingQuest = await QuestsUser.findOne({
    where: { idUser: userId, idQuest: questHeaderId },
    transaction
  });

  if (existingQuest) {
    logger.info(`[RewardService] Usuario ya tiene la quest ${questHeaderId}`);
    return { assigned: false, questTitle: questHeader.title };
  }

  // Asignar la quest al usuario usando la lógica existente
  const questService = require('./questService');
  const createdQuestUser = await questService.createQuestUser(userId, questHeader, transaction);

  logger.info(`[RewardService] Quest "${questHeader.title}" asignada a usuario ${userId}`);
  return { assigned: true, questTitle: questHeader.title, questUser: createdQuestUser };
}

/**
 * Create informative message about rewards/penalties
 */
async function createRewardMessage(userId, questTitle, adjunts, isReward, transaction) {
  const messageType = isReward ? 'reward' : 'penalty';
  const titleText = isReward ? 'Recompensa de misión' : 'Penalización de misión';
  const actionText = isReward ? 'otorgado las siguientes recompensas' : 'aplicado las siguientes penalizaciones';
  
  const descriptionText = `La misión "${questTitle}" te ha ${actionText}:`;

  // Crear message_user directamente con type, title, description y adjunts
  await MessageUser.create({
    id_user: userId,
    type: messageType,
    title: titleText,
    description: descriptionText,
    adjunts: adjunts
  }, { transaction });

  logger.info(`[RewardService] Mensaje de ${messageType} creado para usuario ${userId}`);
}

/**
 * Check if user leveled up and send notification message
 */
async function checkAndNotifyLevelUp(userId, transaction) {
  // Fetch updated user with current totalExp
  const user = await User.findByPk(userId, { 
    attributes: ['id', 'totalExp'],
    transaction 
  });
  
  if (!user) return;

  // Find current level based on totalExp
  const currentLevel = await UsersLevel.findOne({
    where: {
      minExpRequired: {
        [Op.lte]: user.totalExp
      }
    },
    order: [['minExpRequired', 'DESC']],
    transaction
  });

  if (!currentLevel) return;

  const userBefore = await User.findByPk(userId, { 
    attributes: ['level'],
    transaction 
  });

  if (userBefore && userBefore.level !== currentLevel.levelNumber) {
    logger.info(`Usuario sube al nivel ${currentLevel.levelNumber}`);
    
    setImmediate(async () => {
      try {
        await autoMessageService.sendLevelUpMessage(userId, currentLevel.levelNumber);
      } catch (err) {
        logger.debug('[RewardService] checkAndNotifyLevelUp - message sending failed', { error: err.message });
      }
    });
  }
}

module.exports = {
  processQuestRewards,
  applyExperience,
  applyCoins,
  applyQuestReward
};
