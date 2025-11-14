const questService = require('../services/questService');
const logger = require('../utils/logger');
const { formatQuestsPayload } = require('../utils/responseFormatter');
const ERROR_MESSAGES = require('../utils/errorMessages');

async function loadQuests(req, res) {
  try {
    const userId = req.body && req.body.userId ? req.body.userId : null;
    if (!userId) {
      return res.status(400).json({ error: ERROR_MESSAGES.QUEST.USER_ID_REQUIRED });
    }

    const questsRewarded = await questService.updateQuestStates(userId);
    const assigned = await questService.assignQuestToUser(userId);
    const quests = await questService.getUserQuests(userId);

    return res.status(200).json({ questsRewarded, quests });
  } catch (err) {
    logger.error('[QuestController] Error in loadQuests:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function activateQuest(req, res) {
  try {
    const userId = req.body && req.body.userId ? req.body.userId : null;
    const questUserId = req.body && req.body.idQuest ? req.body.idQuest : null;
    
    if (!userId || !questUserId) {
      return res.status(400).json({ error: ERROR_MESSAGES.QUEST.QUEST_ID_REQUIRED });
    }

    const activated = await questService.activateQuest(userId, questUserId);
    if (!activated) {
      return res.status(404).json({ error: ERROR_MESSAGES.QUEST.NOT_FOUND });
    }

    return res.status(200).json(formatQuestsPayload(activated));
  } catch (err) {
    if (err && err.name === 'InvalidQuestState') {
      return res.status(400).json({ error: err.message });
    }
    logger.error('[QuestController] Error in activateQuest:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function submitParams(req, res) {
  try {
    const userId = req.body && (req.body.userId || req.body.idUser) ? (req.body.userId || req.body.idUser) : null;
    const idQuest = req.body && (req.body.idQuest || req.body.questUserId) ? (req.body.idQuest || req.body.questUserId) : null;

    let values = null;
    if (req.body && Array.isArray(req.body.values)) {
      values = req.body.values.map(item => {
        if (item && item.value && typeof item.value === 'object' && (typeof item.value.idDetail !== 'undefined')) {
          return { idDetail: item.value.idDetail, value: item.value.value };
        }
        if (item && (typeof item.idDetail !== 'undefined')) {
          return { idDetail: item.idDetail, value: item.value };
        }
        return item;
      });
    } else if (req.body && (typeof req.body.idDetail !== 'undefined')) {
      values = [{ idDetail: req.body.idDetail, value: req.body.value }];
    }

    if (!userId || !idQuest || !values) {
      return res.status(400).json({ error: ERROR_MESSAGES.QUEST.PARAMS_REQUIRED });
    }

    const result = await questService.saveQuestParams(userId, idQuest, values);
    if (!result || !result.success) {
      return res.status(400).json({ error: result && result.message ? result.message : 'Validation failed', details: result && result.details ? result.details : undefined });
    }

    if (result.quests) {
      return res.status(200).json(formatQuestsPayload(result.quests));
    }

    return res.status(200).json({ success: true, updated: result.updated });
  } catch (err) {
    logger.error('[QuestController] Error in submitParams:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function checkDetailQuest(req, res) {
  try {
    const userId = req.body && (req.body.userId || req.body.idUser) ? (req.body.userId || req.body.idUser) : null;
    const idQuestUserDetail = req.body && (typeof req.body.idQuestUserDetail !== 'undefined') ? req.body.idQuestUserDetail : null;
    const checked = typeof req.body.checked !== 'undefined' ? req.body.checked : null;

    if (!userId || idQuestUserDetail === null || checked === null) {
      return res.status(400).json({ error: ERROR_MESSAGES.QUEST.CHECK_REQUIRED });
    }

    const updated = await questService.setQuestUserDetailChecked(userId, { idQuestUserDetail, checked });
    if (!updated) {
      return res.status(404).json({ error: 'Detail not found or does not belong to user' });
    }

    try {
      const quests = await questService.getUserQuests(userId);
      const found = quests.find(q => q.header && Number(q.header.idQuestHeader) === Number(updated.idQuest));
      return res.status(200).json(formatQuestsPayload(found || null));
    } catch (e) {
      return res.sendStatus(200);
    }
  } catch (err) {
    logger.error('[QuestController] Error in checkDetailQuest:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  loadQuests,
  activateQuest,
  submitParams
  ,checkDetailQuest
};
