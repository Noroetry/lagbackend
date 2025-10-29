const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/login', userController.login);
router.get('/getAll', protect, userController.getAllUsers);
router.get('/getById/:id', protect, userController.getUserById);
router.post('/create', userController.createUser);

module.exports = router;
