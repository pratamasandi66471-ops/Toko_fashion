const bcrypt = require('bcrypt');

const userModel = require('../models/user.model');
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
    email: req.body.email || '',
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
    const existingUser = await userModel.emailExists(req.body.email);

    if (existingUser) {
      res.status(422);
      return renderRegister(res, {
        formErrors: {
          email: 'Email sudah terdaftar.',
        },
        old,
      });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);

    await userModel.createCustomer({
      name: req.body.name,
      email: req.body.email,
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
    email: req.body.email || '',
  };

  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    res.status(422);
    return renderLogin(res, {
      formErrors: req.formErrors,
      old,
    });
  }

  try {
    const user = await userModel.findByEmail(req.body.email);
    const userStatus = (user?.status || '').toLowerCase();
    const isStatusActive = userStatus === 'active';
    const hashedPassword = user?.password;

    if (!user || !isStatusActive || !hashedPassword) {
      res.status(401);
      return renderLogin(res, {
        formErrors: {
          general: 'Email atau password salah.',
        },
        old,
      });
    }

    const isValidPassword = await bcrypt.compare(req.body.password, hashedPassword);

    if (!isValidPassword) {
      res.status(401);
      return renderLogin(res, {
        formErrors: {
          general: 'Email atau password salah.',
        },
        old,
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    req.flash('success', `Selamat datang kembali, ${user.name}!`);
    return res.redirect(redirectByRole(user.role));
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
