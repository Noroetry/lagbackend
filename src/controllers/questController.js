const questService = require('../services/questService');
const logger = require('../utils/logger');

async function loadQuests(req, res) {
  try {
    // Se espera recibir userId (por ahora no implementado)
    const userId = req.body && req.body.userId ? req.body.userId : null;
    if (!userId) {
      logger.warn('[QuestController] loadQuests called without userId', { body: req.body });
      return res.status(400).json({ error: 'userId is required' });
    }

    const start = Date.now();

    const questsRewarded = await questService.updateQuestStates(userId);
    logger.info('[QuestController] updateQuestStates completed', { userId, rewardedCount: questsRewarded.length });
  
    const assigned = await questService.assignQuestToUser(userId);
    logger.info('[QuestController] assignQuestToUser completed', { userId, assignedCount: Array.isArray(assigned) ? assigned.length : 0 });
   
    const quests = await questService.getUserQuests(userId);
    logger.info('[QuestController] getUserQuests completed', { userId, questsCount: quests.length });
  
    const duration = Date.now() - start;
    logger.info('[QuestController] loadQuests finished', { userId, durationMs: duration });

    logger.debug('[QuestController] loadQuests response', { userId, questsRewarded, quests });
    return res.status(200).json({ questsRewarded, quests });
  } catch (err) {
    logger.error('[QuestController] Error in loadQuests:', err && err.message ? err.message : err, { stack: err && err.stack ? err.stack : undefined });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function activateQuest(req, res) {
  try {
    const userId = req.body && req.body.userId ? req.body.userId : null;
    // Note: frontend will send `idQuest` which refers to the quests_users.id row
    const questUserId = req.body && req.body.idQuest ? req.body.idQuest : null;
    if (!userId || !questUserId) {
      logger.warn('[QuestController] activateQuest called without required params', { body: req.body });
      return res.status(400).json({ error: 'userId and idQuest (quests_users id) are required' });
    }

  // Log the activation attempt for observability
  logger.info('[QuestController] activateQuest called', { userId, idQuest: questUserId, body: req.body });

  // Delegate to service to perform checks and update
  const activated = await questService.activateQuest(userId, questUserId);
    if (!activated) {
      return res.status(404).json({ error: 'Quest not found or could not be activated' });
    }

    // activated will be the formatted quest object; return as array of one element for frontend reuse
    return res.status(200).json({ quests: [activated] });
  } catch (err) {
    // If service signals a bad request, propagate 400
    if (err && err.name === 'InvalidQuestState') {
      return res.status(400).json({ error: err.message });
    }
    logger.error('[QuestController] Error in activateQuest:', err && err.message ? err.message : err, { stack: err && err.stack ? err.stack : undefined });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  loadQuests
  , activateQuest
};
