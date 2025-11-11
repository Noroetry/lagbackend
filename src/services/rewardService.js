const db = require('../config/database');
const QuestsUser = db.QuestsUser;
const QuestsObject = db.QuestsObject;
const ObjectItem = db.ObjectItem;
const User = db.User;
const Sequelize = db.Sequelize;
const logger = require('../utils/logger');

/**
 * Ensure there is an ObjectItem of type 'experience'. If missing, create it.
 * Returns the ObjectItem instance.
 * @param {Transaction|null} transaction
 */
async function checkObjectExperience(transaction = null) {
  const where = { type: 'experience' };
  const obj = await ObjectItem.findOne({ where, transaction });
  if (obj) return obj;

  // Create a default experience object
  const created = await ObjectItem.create({
    objectName: 'Experiencia',
    description: 'Experiencia',
    type: 'experience',
    shortName: 'EXP'
  }, transaction ? { transaction } : {});
  logger.info('[RewardService] checkObjectExperience - created default experience object', { id: created.id });
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

  // If caller didn't provide a transaction, create one so operations are atomic.
  const externalTx = !!transaction;
  const t = transaction || await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    // Reload questUser inside the transaction with lock to ensure we have the latest state
    const qu = await QuestsUser.findOne({ where: { id: questUser.id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!qu) throw new Error('QuestsUser not found');

    if (qu.rewardDelivered) {
      logger.warn('[RewardService] processQuestRewards - already delivered, skipping', { questUserId: qu.id });
      if (!externalTx) await t.commit();
      return qu;
    }

    // Decide which quest object types to process depending on quest state
    let wantedType = null;
    if (qu.state === 'C') wantedType = 'R';
    else if (qu.state === 'E') wantedType = 'P';
    else {
      logger.warn('[RewardService] processQuestRewards - unexpected quest state, skipping', { questUserId: qu.id, state: qu.state });
      if (!externalTx) await t.commit();
      return qu;
    }

    // Fetch quest objects for this quest filtered by type
    const qObjects = await QuestsObject.findAll({ where: { idQuest: qu.idQuest, type: wantedType }, transaction: t });

    // Ensure experience object exists (used below)
    const expObject = await checkObjectExperience(t);

    // Load the user and lock the row for update
    const user = await User.findByPk(qu.idUser, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('User not found');

    const applied = [];
    for (const qo of qObjects) {
      const item = await ObjectItem.findByPk(qo.idObject, { transaction: t });
      if (!item) {
        logger.warn('[RewardService] processQuestRewards - object item not found, skipping', { idObject: qo.idObject });
        continue;
      }

      const itemType = (item.type || '').toLowerCase();
      const quantity = Number(qo.quantity) || 0;

      if (itemType === 'experience' || itemType === 'experiencie') {
        const toAdd = Math.round(quantity);
        // Use increment to safely update bigints
        await user.increment({ totalExp: toAdd }, { transaction: t });
        applied.push({ type: 'experience', quantity: toAdd, idObject: item.id, appliedAs: wantedType });
        logger.info('[RewardService] processQuestRewards - applied experience', { userId: user.id, added: toAdd });
      } else {
        // For now, unhandled item types are logged and ignored; future implementations go here.
        applied.push({ type: item.type, quantity, idObject: item.id, appliedAs: wantedType, note: 'unhandled-type' });
        logger.info('[RewardService] processQuestRewards - unhandled object type', { userId: user.id, itemType: item.type });
      }
    }

    // Mark as delivered
    qu.rewardDelivered = true;
    await qu.save({ transaction: t });
    logger.info('[RewardService] processQuestRewards - marked rewardDelivered', { questUserId: qu.id });

    if (!externalTx) await t.commit();
    return { questUser: qu, applied };
  } catch (e) {
    try { if (!externalTx) await t.rollback(); } catch (er) { logger.error('[RewardService] processQuestRewards rollback failed', { error: er && er.message ? er.message : er }); }
    logger.error('[RewardService] processQuestRewards - error', { error: e && e.message ? e.message : e });
    throw e;
  }
}

module.exports = {
  processQuestRewards,
  checkObjectExperience
};
