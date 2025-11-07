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
    logger.info('[QuestController] loadQuests start', { userId, body: req.body });

    // 1) Actualizamos estados y procesamos recompensas pendientes
    logger.debug('[QuestController] Calling updateQuestStates', { userId });
    const questsRewarded = await questService.updateQuestStates(userId);
    logger.info('[QuestController] updateQuestStates completed', { userId, rewardedCount: Array.isArray(questsRewarded) ? questsRewarded.length : 0 });
    logger.debug('[QuestController] updateQuestStates result sample', { sample: questsRewarded && questsRewarded.slice ? questsRewarded.slice(0,3) : questsRewarded });

    // 2) Asignamos nuevas quests si hay plantillas que cumplan requisitos
    logger.debug('[QuestController] Calling assignQuestToUser', { userId });
    const assigned = await questService.assignQuestToUser(userId);
    logger.info('[QuestController] assignQuestToUser completed', { userId, assignedCount: Array.isArray(assigned) ? assigned.length : 0 });
    logger.debug('[QuestController] assignQuestToUser sample', { sample: assigned && assigned.slice ? assigned.slice(0,3) : assigned });

    // 3) Obtenemos las quests activas para devolver al frontend
    logger.debug('[QuestController] Calling getActiveQuestsForUser', { userId });
    const activeQuests = await questService.getActiveQuestsForUser(userId);
    logger.info('[QuestController] getActiveQuestsForUser completed', { userId, activeCount: Array.isArray(activeQuests) ? activeQuests.length : 0 });

    const duration = Date.now() - start;
    logger.info('[QuestController] loadQuests finished', { userId, durationMs: duration });

    return res.status(200).json({ questsRewarded, assigned, activeQuests });
  } catch (err) {
    logger.error('[QuestController] Error in loadQuests:', err && err.message ? err.message : err, { stack: err && err.stack ? err.stack : undefined });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  loadQuests
};
