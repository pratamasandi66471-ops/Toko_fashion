const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.',
  skipSuccessfulRequests: true,
});

module.exports = {
  authLimiter,
};
