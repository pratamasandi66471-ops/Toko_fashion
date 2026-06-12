const redirectByRole = require('../helper/redirectByRole');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Please login to continue.');
    return res.redirect('/login');
  }

  return next();
}

function isGuest(req, res, next) {
  if (!req.session.user) {
    return next();
  }

  return res.redirect(redirectByRole(req.session.user.role));
}

module.exports = {
  requireAuth,
  isGuest,
};
