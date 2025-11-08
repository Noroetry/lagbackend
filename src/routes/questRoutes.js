const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const questController = require('../controllers/questController');

// POST /api/quests/load  -> expects { userId }
router.post('/load', protect, questController.loadQuests);
// POST /api/quests/activate -> expects { userId, questUserId }
router.post('/activate', protect, questController.activateQuest);

module.exports = router;
