const { body, validationResult } = require('express-validator');

const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidator = [
  body('username').isLength({ min: 3 }).withMessage('username mínimo 3 chars'),
  body('email').isEmail().withMessage('email inválido'),
  body('password').isLength({ min: 6 }).withMessage('password mínimo 6 chars'),
  checkValidation
];

const loginValidator = [
  body('usernameOrEmail').notEmpty().withMessage('usernameOrEmail requerido'),
  body('password').notEmpty().withMessage('password requerido'),
  checkValidation
];

const sendMessageValidator = [
  body('title').notEmpty().withMessage('title requerido'),
  body('description').notEmpty().withMessage('description requerido'),
  body('destination').notEmpty().withMessage('destination requerido'),
  checkValidation
];

const changeStateValidator = [
  body('state').isIn(['A','D','R']).withMessage('state inválido'),
  checkValidation
];

module.exports = {
  registerValidator,
  loginValidator,
  sendMessageValidator,
  changeStateValidator
};
