const questService = require('../services/questService');
const logger = require('../utils/logger');

async function loadQuests(req, res) {
  try {
    // Se espera recibir userId (por ahora no implementado)
    const userId = req.body && req.body.userId ? req.body.userId : null;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

  // 1) Actualizamos estados y procesamos recompensas pendientes
  const questsRewarded = await questService.updateQuestStates(userId);
    
  // 2) Asignamos nuevas quests si hay plantillas que cumplan requisitos
  const assigned = await questService.assignQuestToUser(userId);

  // 3) Obtenemos las quests activas para devolver al frontend
  const activeQuests = await questService.getActiveQuestsForUser(userId);

  return res.status(200).json({ questsRewarded, assigned, activeQuests });
  } catch (err) {
    logger.error('[QuestController] Error in loadQuests:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  loadQuests
};
