const questService = require('../services/questService');
const logger = require('../utils/logger');
const { formatQuestsPayload } = require('../utils/responseFormatter');

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
  return res.status(200).json(formatQuestsPayload(activated));
  } catch (err) {
    // If service signals a bad request, propagate 400
    if (err && err.name === 'InvalidQuestState') {
      return res.status(400).json({ error: err.message });
    }
    logger.error('[QuestController] Error in activateQuest:', err && err.message ? err.message : err, { stack: err && err.stack ? err.stack : undefined });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function submitParams(req, res) {
  try {
    // Accept either userId or idUser from frontend (some clients send idUser)
    const userId = req.body && (req.body.userId || req.body.idUser) ? (req.body.userId || req.body.idUser) : null;
    // idQuest may refer to the quests_users.id (frontend uses idQuest currently)
    const idQuest = req.body && (req.body.idQuest || req.body.questUserId) ? (req.body.idQuest || req.body.questUserId) : null;

    // Normalize values: frontend may send either an array `values: [{ idDetail, value }]`,
    // or an array where each element wraps the payload under `value: { idDetail, value }` —
    // example from frontend:
    // values: [ { value: { idDetail: 2, value: 30 }, idUser: 9, idQuest: 18 }, ... ]
    // Also support the single-item shorthand idDetail+value at top-level.
    let values = null;
    if (req.body && Array.isArray(req.body.values)) {
      // map/flatten incoming values into { idDetail, value }
      values = req.body.values.map(item => {
        if (item && item.value && typeof item.value === 'object' && (typeof item.value.idDetail !== 'undefined')) {
          return { idDetail: item.value.idDetail, value: item.value.value };
        }
        if (item && (typeof item.idDetail !== 'undefined')) {
          return { idDetail: item.idDetail, value: item.value };
        }
        // fallback: return as-is (will be validated later)
        return item;
      });
    } else if (req.body && (typeof req.body.idDetail !== 'undefined')) {
      // single value submission
      values = [{ idDetail: req.body.idDetail, value: req.body.value }];
    }

    if (!userId || !idQuest || !values) {
      logger.warn('[QuestController] submitParams missing params', { body: req.body });
      return res.status(400).json({ error: 'userId (or idUser), idQuest and values (or idDetail+value) are required' });
    }

    const result = await questService.saveQuestParams(userId, idQuest, values);
    if (!result || !result.success) {
      return res.status(400).json({ error: result && result.message ? result.message : 'Validation failed', details: result && result.details ? result.details : undefined });
    }

    // Service now returns `quests` array for consistency. If present, return it.
    if (result.quests) {
      return res.status(200).json(formatQuestsPayload(result.quests));
    }

    // Fallback: return updated info
    return res.status(200).json({ success: true, updated: result.updated });
  } catch (err) {
    logger.error('[QuestController] Error in submitParams:', err && err.message ? err.message : err, { stack: err && err.stack ? err.stack : undefined });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function checkDetailQuest(req, res) {
  try {
    // Expect exactly: { userId, idQuestUserDetail, checked }
    const userId = req.body && (req.body.userId || req.body.idUser) ? (req.body.userId || req.body.idUser) : null;
    const idQuestUserDetail = req.body && (typeof req.body.idQuestUserDetail !== 'undefined') ? req.body.idQuestUserDetail : null;
    const checked = typeof req.body.checked !== 'undefined' ? req.body.checked : null;

    if (!userId || idQuestUserDetail === null || checked === null) {
      logger.warn('[QuestController] checkDetailQuest missing params', { body: req.body });
      return res.status(400).json({ error: 'userId, idQuestUserDetail and checked are required' });
    }

    // Delegate to service — using only idQuestUserDetail as unique identifier per request
    const updated = await questService.setQuestUserDetailChecked(userId, { idQuestUserDetail, checked });
    if (!updated) {
      return res.status(404).json({ error: 'Detail not found or does not belong to user' });
    }

    // After updating the detail, return the full formatted quest object (as an array with one element)
    // so frontend receives the same shape as activateQuest responses.
    try {
      const quests = await questService.getUserQuests(userId);
      // find by header id (the template id stored in updated.idQuest)
      const found = quests.find(q => q.header && Number(q.header.idQuestHeader) === Number(updated.idQuest));
      return res.status(200).json(formatQuestsPayload(found || null));
    } catch (e) {
      logger.warn('[QuestController] checkDetailQuest - failed to fetch formatted quest after update', { error: e && e.message ? e.message : e });
      // fallback: simple 200 if formatting failed
      return res.sendStatus(200);
    }
  } catch (err) {
    logger.error('[QuestController] Error in checkDetailQuest:', err && err.message ? err.message : err, { stack: err && err.stack ? err.stack : undefined });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  loadQuests,
  activateQuest,
  submitParams
  ,checkDetailQuest
};
