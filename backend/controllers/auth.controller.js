const userModel = require('../models/user.model');
const authService = require('../services/auth.service');
const redirectByRole = require('../helper/redirectByRole');

function renderRegister(res, data = {}) {
  return res.render('auth/register', {
    layout: 'layouts/auth',
    pageTitle: 'Register',
    formErrors: {},
    old: {},
    ...data,
  });
}

function renderLogin(res, data = {}) {
  return res.render('auth/login', {
    layout: 'layouts/auth',
    pageTitle: 'Login',
    formErrors: {},
    old: {},
    ...data,
  });
}

async function showRegister(req, res) {
  if (req.session.user) {
    return res.redirect(redirectByRole(req.session.user.role));
  }

  return renderRegister(res);
}

async function register(req, res) {
  if (req.session.user) {
    return res.redirect(redirectByRole(req.session.user.role));
  }

  const old = {
    name: req.body.name || '',
    email: authService.normalizeEmail(req.body.email),
    phone: req.body.phone || '',
    terms: req.body.terms || '',
  };

  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    res.status(422);
    return renderRegister(res, {
      formErrors: req.formErrors,
      old,
    });
  }

  try {
    const email = authService.normalizeEmail(req.body.email);
    const existingUser = await userModel.emailExists(email);

    if (existingUser) {
      res.status(422);
      return renderRegister(res, {
        formErrors: {
          email: 'Email sudah terdaftar.',
        },
        old,
      });
    }

    const passwordHash = await authService.hashPassword(req.body.password);

    await userModel.createCustomer({
      name: req.body.name,
      email,
      phone: req.body.phone,
      passwordHash,
    });

    req.flash('success', 'Registrasi berhasil. Silakan login.');
    return res.redirect('/login');
  } catch (error) {
    console.error(error);

    res.status(500);
    return renderRegister(res, {
      formErrors: {
        general: 'Terjadi kesalahan. Coba lagi.',
      },
      old,
    });
  }
}

async function showLogin(req, res) {
  if (req.session.user) {
    return res.redirect(redirectByRole(req.session.user.role));
  }

  return renderLogin(res);
}

async function login(req, res) {
  if (req.session.user) {
    return res.redirect(redirectByRole(req.session.user.role));
  }

  const old = {
    email: authService.normalizeEmail(req.body.email),
  };

  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    res.status(422);
    return renderLogin(res, {
      formErrors: req.formErrors,
      old,
    });
  }

  try {
    const user = await userModel.findByEmail(authService.normalizeEmail(req.body.email));

    if (!authService.canAuthenticate(user)) {
      res.status(401);
      return renderLogin(res, {
        formErrors: {
          general: 'Email atau password salah.',
        },
        old,
      });
    }

    const isValidPassword = await authService.verifyPassword(req.body.password, user.password);

    if (!isValidPassword) {
      res.status(401);
      return renderLogin(res, {
        formErrors: {
          general: 'Email atau password salah.',
        },
        old,
      });
    }

    req.session.user = authService.buildSessionUser(user);

    req.flash('success', `Selamat datang kembali, ${user.name}!`);
    return res.redirect(redirectByRole(req.session.user.role));
  } catch (error) {
    console.error(error);

    res.status(500);
    return renderLogin(res, {
      formErrors: {
        general: 'Terjadi kesalahan. Coba lagi.',
      },
      old,
    });
  }
}

function logout(req, res) {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);
      req.flash('error', 'Gagal logout. Silakan coba lagi.');
      return res.redirect('/');
    }

    res.clearCookie('sfashion.sid');
    return res.redirect('/login');
  });
}

module.exports = {
  showRegister,
  register,
  showLogin,
  login,
  logout,
};
