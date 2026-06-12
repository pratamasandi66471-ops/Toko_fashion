const session = require('express-session');

function createSessionMiddleware() {
  const maxAge = 24 * 60 * 60 * 1000;

  return session({
    name: 'sfashion.sid',
    secret: process.env.SESSION_SECRET || 'sfashion-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  });
}

module.exports = createSessionMiddleware;
