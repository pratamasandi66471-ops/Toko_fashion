const express = require('express');
const { body, validationResult } = require('express-validator');

const authController = require('../controllers/auth.controller');
const { isGuest } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

const registerValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nama wajib diisi.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email wajib diisi.')
    .isEmail()
    .withMessage('Format email tidak valid.')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Nomor telepon wajib diisi.')
    .matches(/^[0-9+\-\s]{8,20}$/)
    .withMessage('Nomor telepon tidak valid.'),
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi.')
    .isLength({ min: 8 })
    .withMessage('Password minimal 8 karakter.'),
  body('confirm_password')
    .notEmpty()
    .withMessage('Konfirmasi password wajib diisi.')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Konfirmasi password tidak sama.'),
  body('terms')
    .custom((value) => ['on', 'true', '1', true].includes(value))
    .withMessage('Kamu harus menyetujui syarat dan ketentuan.'),
];

const loginValidationRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email wajib diisi.')
    .isEmail()
    .withMessage('Format email tidak valid.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi.'),
];

function handleValidation(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    req.formErrors = {};
    return next();
  }

  req.formErrors = result.array().reduce((acc, error) => {
    if (!acc[error.path]) {
      acc[error.path] = error.msg;
    }
    return acc;
  }, {});

  return next();
}

router.get('/register', isGuest, authController.showRegister);
router.post('/register', authLimiter, registerValidationRules, handleValidation, authController.register);

router.get('/login', isGuest, authController.showLogin);
router.post('/login', authLimiter, loginValidationRules, handleValidation, authController.login);

router.post('/logout', authController.logout);

module.exports = router;
