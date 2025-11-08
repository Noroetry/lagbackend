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

module.exports = {
  loadQuests
};
