const db = require('../config/database');
const QuestsUser = db.QuestsUser;
const QuestsObject = db.QuestsObject;
const ObjectItem = db.ObjectItem;
const User = db.User;
const UsersLevel = db.UsersLevel;
const Sequelize = db.Sequelize;
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const autoMessageService = require('./autoMessageService');

/**
 * Ensure there is an ObjectItem of type 'experience'. If missing, create it.
 * Returns the ObjectItem instance.
 * @param {Transaction|null} transaction
 */
async function checkObjectExperience(transaction = null) {
  const where = { type: 'experience' };
  const obj = await ObjectItem.findOne({ where, transaction });
  if (obj) return obj;

  const created = await ObjectItem.create({
    objectName: 'Experiencia',
    description: 'Experiencia',
    type: 'experience',
    shortName: 'EXP'
  }, transaction ? { transaction } : {});
  return created;
}

/**
 * Process rewards/penalties for a QuestsUser instance.
 * - Validates rewardDelivered is false before proceeding.
 * - Fetches quests_objects filtered by quest id and by type depending on questUser.state
 *   (state 'C' => type 'R', state 'E' => type 'P').
 * - Ensures an experience ObjectItem exists.
 * - Applies effects to the user (currently only 'experience' type updates totalExp).
 * - Marks questUser.rewardDelivered = true and persists.
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
    if (qu.state === 'C') wantedType = 'R';
    else if (qu.state === 'E') wantedType = 'P';
    else {
      if (!externalTx) await t.commit();
      return qu;
    }

    const qObjects = await QuestsObject.findAll({ where: { idQuest: qu.idQuest, type: wantedType }, transaction: t });
    const expObject = await checkObjectExperience(t);
    const user = await User.findByPk(qu.idUser, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('User not found');

    const applied = [];
    for (const qo of qObjects) {
      const item = await ObjectItem.findByPk(qo.idObject, { transaction: t });
      if (!item) {
        continue;
      }

      const itemType = (item.type || '').toLowerCase();
      const quantity = Number(qo.quantity) || 0;

      if (itemType === 'experience' || itemType === 'experiencie') {
        const absQty = Math.round(Math.abs(quantity));
        const delta = (wantedType === 'P') ? -absQty : absQty;

        try {
          await db.sequelize.query(
            'UPDATE "users" SET "totalExp" = GREATEST(0, "totalExp" + :delta) WHERE "id" = :id',
            { transaction: t, replacements: { delta, id: user.id }, type: Sequelize.QueryTypes.UPDATE }
          );
        } catch (e) {
          logger.error('[RewardService] Error aplicando experiencia', { error: e && e.message ? e.message : e });
          throw e;
        }

        applied.push({ type: 'experience', quantity: absQty, signedDelta: delta, idObject: item.id, appliedAs: wantedType });
        
        const action = wantedType === 'R' ? 'gana' : 'pierde';
        logger.info(`Usuario ${action} ${Math.abs(delta)} EXP`);
      } else {
        applied.push({ type: item.type, quantity, idObject: item.id, appliedAs: wantedType, note: 'unhandled-type' });
      }
    }

    qu.rewardDelivered = true;
    await qu.save({ transaction: t });

    if (applied.length > 0) {
      const expReward = applied.find(a => a.type === 'experience');
      if (expReward && expReward.signedDelta > 0) {
        try {
          await checkAndNotifyLevelUp(user.id, t);
        } catch (err) {
          // Silently fail level check
        }
      }
    }

    if (applied.length > 0) {
      try {
        const rewardParts = applied.map(reward => {
          if (reward.type === 'experience') {
            const sign = reward.signedDelta > 0 ? '+' : '';
            return `${sign}${reward.signedDelta} EXP`;
          }
          return `${reward.type}: ${reward.quantity}`;
        });
        const rewardDescription = rewardParts.join(', ');
        
        setImmediate(async () => {
          try {
            await autoMessageService.sendRewardResultMessage(qu.idUser, rewardDescription);
          } catch (err) {
            // Silently fail message sending
          }
        });
      } catch (err) {
        // Silently fail message preparation
      }
    }

    if (!externalTx) await t.commit();
    return { questUser: qu, applied };
  } catch (e) {
    try { if (!externalTx) await t.rollback(); } catch (er) { logger.error('[RewardService] Rollback failed', { error: er && er.message ? er.message : er }); }
    logger.error('[RewardService] Error procesando recompensas', { error: e && e.message ? e.message : e });
    throw e;
  }
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
        // Silently fail message sending
      }
    });
  }
}

module.exports = {
  processQuestRewards,
  checkObjectExperience
};
