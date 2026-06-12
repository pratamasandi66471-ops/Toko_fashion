const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

require('./config/env');

const webRoutes = require('./routes/web.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const staffRoutes = require('./routes/staff.routes');
const cartModel = require('./models/cart.model');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

app.use(expressLayouts);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  session({
    name: 'sfashion.sid',
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flashSuccess = req.flash('success');
  res.locals.flashError = req.flash('error');
  res.locals.cartCount = 0;
  next();
});

app.use(async (req, res, next) => {
  try {
    if (!req.session.user?.id) {
      return next();
    }

    const count = await cartModel.getCartCountByUser(req.session.user.id);
    res.locals.cartCount = Number.isFinite(count) ? count : 0;
    return next();
  } catch (error) {
    console.error(error);
    res.locals.cartCount = 0;
    return next();
  }
});

app.use(authRoutes);
app.use('/admin', adminRoutes);
app.use('/staff', staffRoutes);
app.use(webRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
