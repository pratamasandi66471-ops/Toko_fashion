function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.session.user?.role;

    if (!role) {
      req.flash('error', 'Please login to continue.');
      return res.redirect('/login');
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).render('pages/forbidden', {
        pageTitle: 'Access Forbidden',
      });
    }

    return next();
  };
}

module.exports = {
  requireRole,
};
