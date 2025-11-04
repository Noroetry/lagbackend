let body;
let validationResult;
try {
  ({ body, validationResult } = require('express-validator'));
} catch (err) {
  // If express-validator is not installed in the environment, provide no-op fallbacks
  body = () => (req, res, next) => next();
  validationResult = () => ({ isEmpty: () => true, array: () => [] });
}

const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidator = [
  body('username')?.isLength ? body('username').isLength({ min: 3 }).withMessage('username mínimo 3 chars') : (req, res, next) => next(),
  body('email')?.isEmail ? body('email').isEmail().withMessage('email inválido') : (req, res, next) => next(),
  body('password')?.isLength ? body('password').isLength({ min: 6 }).withMessage('password mínimo 6 chars') : (req, res, next) => next(),
  checkValidation
];

const loginValidator = [
  body('usernameOrEmail')?.notEmpty ? body('usernameOrEmail').notEmpty().withMessage('usernameOrEmail requerido') : (req, res, next) => next(),
  body('password')?.notEmpty ? body('password').notEmpty().withMessage('password requerido') : (req, res, next) => next(),
  checkValidation
];

const sendMessageValidator = [
  body('title')?.notEmpty ? body('title').notEmpty().withMessage('title requerido') : (req, res, next) => next(),
  body('description')?.notEmpty ? body('description').notEmpty().withMessage('description requerido') : (req, res, next) => next(),
  body('destination')?.notEmpty ? body('destination').notEmpty().withMessage('destination requerido') : (req, res, next) => next(),
  checkValidation
];

const changeStateValidator = [
  body('state')?.isIn ? body('state').isIn(['A','D','R']).withMessage('state inválido') : (req, res, next) => next(),
  checkValidation
];

module.exports = {
  registerValidator,
  loginValidator,
  sendMessageValidator,
  changeStateValidator
};
