const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();
const { registerValidator, loginValidator } = require('../middlewares/validators');

router.post('/login', loginValidator, userController.login);
router.get('/me', protect, userController.getMe);
router.get('/getAll', protect, userController.getAllUsers);
router.get('/getById/:id', protect, userController.getUserById);
router.post('/create', registerValidator, userController.createUser);

module.exports = router;
