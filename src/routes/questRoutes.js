const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const questController = require('../controllers/questController');

// POST /api/quests/load  -> expects { userId }
router.post('/load', protect, questController.loadQuests);

module.exports = router;
