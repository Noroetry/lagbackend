const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const questController = require('../controllers/questController');

// POST /api/quests/load  -> expects { userId }
router.post('/load', protect, questController.loadQuests);
// POST /api/quests/activate -> expects { userId, questUserId }
router.post('/activate', protect, questController.activateQuest);
// POST /api/quests/submit-params -> expects { userId, idQuest, values: [{ idDetail, value }] }
router.post('/submit-params', protect, questController.submitParams);
// POST /api/quests/check-detail-quest -> expects { userId, checked:boolean, idQuestUserDetail OR idQuest + idDetail }
router.post('/check-detail-quest', protect, questController.checkDetailQuest);

module.exports = router;
