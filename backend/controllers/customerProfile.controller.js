const customerProfileModel = require('../models/customerProfile.model');
const authService = require('../services/auth.service');

function formatRupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatStatus(value) {
  return String(value || '-').replace(/_/g, ' ');
}

function fieldValue(source, key, fallback = '') {
  const value = source && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallback;
  return value || '';
}

function addressPayload(body = {}) {
  return {
    recipientName: String(body.recipient_name || '').trim(),
    phone: String(body.phone || '').trim(),
    province: String(body.province || '').trim(),
    city: String(body.city || '').trim(),
    district: String(body.district || '').trim(),
    postalCode: String(body.postal_code || '').trim(),
    fullAddress: String(body.full_address || '').trim(),
    isDefault: ['1', 'true', 'on', true].includes(body.is_default),
  };
}

function hasValidationErrors(req) {
  return req.formErrors && Object.keys(req.formErrors).length > 0;
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function getBaseViewData(req, activeProfileMenu, extra = {}) {
  const userId = req.session.user?.id;
  const profile = await customerProfileModel.getProfileDetail(userId);

  return {
    pageTitle: 'My Profile',
    pageCss: '/css/customer/profile.css',
    activeProfileMenu,
    profile,
    formatRupiah,
    formatDate,
    formatStatus,
    fieldValue,
    profileErrors: {},
    profileOld: {},
    passwordErrors: {},
    addressErrors: {},
    addressFormMode: 'create',
    addressFormTarget: '/profile/addresses',
    addressOld: {},
    ...extra,
  };
}

async function renderProfilePage(req, res, template, activeProfileMenu, extra = {}) {
  const viewData = await getBaseViewData(req, activeProfileMenu, extra);

  if (!viewData.profile) {
    req.flash('error', 'Profile customer tidak ditemukan.');
    return res.redirect('/');
  }

  return res.render(template, viewData);
}

function requireCustomerSession(req, res) {
  const userId = req.session.user?.id;
  if (!userId) {
    req.flash('error', 'Silakan login terlebih dahulu.');
    res.redirect('/login');
    return null;
  }

  return userId;
}

async function showOverview(req, res, next) {
  try {
    const userId = requireCustomerSession(req, res);
    if (!userId) return null;

    const [profile, defaultAddress, recentOrders] = await Promise.all([
      customerProfileModel.getProfileSummary(userId),
      customerProfileModel.getDefaultAddress(userId),
      customerProfileModel.getRecentOrders(userId, 2),
    ]);

    return renderProfilePage(req, res, 'pages/profile/overview', 'overview', {
      profile,
      defaultAddress,
      recentOrders,
    });
  } catch (error) {
    return next(error);
  }
}

async function showInfo(req, res, next) {
  try {
    const userId = requireCustomerSession(req, res);
    if (!userId) return null;

    const profile = await customerProfileModel.getProfileDetail(userId);
    return renderProfilePage(req, res, 'pages/profile/info', 'info', { profile });
  } catch (error) {
    return next(error);
  }
}

async function showAddresses(req, res, next) {
  try {
    const userId = requireCustomerSession(req, res);
    if (!userId) return null;

    const [addresses, defaultAddress] = await Promise.all([
      customerProfileModel.getAddresses(userId),
      customerProfileModel.getDefaultAddress(userId),
    ]);

    return renderProfilePage(req, res, 'pages/profile/addresses', 'addresses', {
      addresses,
      defaultAddress,
    });
  } catch (error) {
    return next(error);
  }
}

async function showOrders(req, res, next) {
  try {
    const userId = requireCustomerSession(req, res);
    if (!userId) return null;

    const page = normalizePage(req.query.page);
    const limit = 10;
    const [orders, totalOrders] = await Promise.all([
      customerProfileModel.getOrders(userId, { page, limit }),
      customerProfileModel.countOrders(userId),
    ]);

    return renderProfilePage(req, res, 'pages/profile/orders', 'orders', {
      orders,
      pagination: {
        page,
        limit,
        total: totalOrders,
        totalPages: Math.max(1, Math.ceil(totalOrders / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function showSecurity(req, res, next) {
  try {
    const userId = requireCustomerSession(req, res);
    if (!userId) return null;

    const profile = await customerProfileModel.getProfileDetail(userId);
    return renderProfilePage(req, res, 'pages/profile/security', 'security', { profile });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    if (hasValidationErrors(req)) {
      res.status(422);
      return renderProfilePage(req, res, 'pages/profile/info', 'info', {
        profileErrors: req.formErrors,
        profileOld: req.body,
      });
    }

    const userId = req.session.user.id;
    const payload = {
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
    };

    const updated = await customerProfileModel.updateProfile(userId, payload);
    if (!updated) {
      req.flash('error', 'Profile tidak ditemukan atau tidak bisa diperbarui.');
      return res.redirect('/profile');
    }

    req.session.user.name = payload.name;
    req.flash('success', 'Profile berhasil diperbarui.');
    return res.redirect('/profile/info');
  } catch (error) {
    return next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    if (hasValidationErrors(req)) {
      res.status(422);
      return renderProfilePage(req, res, 'pages/profile/security', 'security', {
        passwordErrors: req.formErrors,
      });
    }

    const userId = req.session.user.id;
    const customer = await customerProfileModel.findCustomerForPassword(userId);

    if (!customer) {
      req.flash('error', 'Profile customer tidak ditemukan.');
      return res.redirect('/profile');
    }

    const isCurrentPasswordValid = await authService.verifyPassword(req.body.current_password, customer.password);
    if (!isCurrentPasswordValid) {
      res.status(422);
      return renderProfilePage(req, res, 'pages/profile/security', 'security', {
        passwordErrors: {
          current_password: 'Password saat ini tidak sesuai.',
        },
      });
    }

    const passwordHash = await authService.hashPassword(req.body.new_password);
    await customerProfileModel.updatePassword(userId, passwordHash);

    req.flash('success', 'Password berhasil diperbarui.');
    return res.redirect('/profile/security');
  } catch (error) {
    return next(error);
  }
}

async function createAddress(req, res, next) {
  try {
    if (hasValidationErrors(req)) {
      res.status(422);
      return renderProfilePage(req, res, 'pages/profile/addresses', 'addresses', {
        addressErrors: req.formErrors,
        addressOld: req.body,
      });
    }

    await customerProfileModel.createAddress(req.session.user.id, addressPayload(req.body));
    req.flash('success', 'Alamat berhasil ditambahkan.');
    return res.redirect('/profile/addresses');
  } catch (error) {
    return next(error);
  }
}

async function updateAddress(req, res, next) {
  try {
    if (hasValidationErrors(req) && req.formErrors.id) {
      req.flash('error', 'Alamat tidak valid.');
      return res.redirect('/profile/addresses');
    }

    const addressId = Number(req.params.id);
    const existingAddress = await customerProfileModel.findAddressByIdAndUser(addressId, req.session.user.id);

    if (!existingAddress) {
      req.flash('error', 'Alamat tidak ditemukan.');
      return res.redirect('/profile/addresses');
    }

    if (hasValidationErrors(req)) {
      res.status(422);
      return renderProfilePage(req, res, 'pages/profile/addresses', 'addresses', {
        addressErrors: req.formErrors,
        addressFormMode: 'edit',
        addressFormTarget: `/profile/addresses/${addressId}/update`,
        addressOld: { ...existingAddress, ...req.body },
      });
    }

    await customerProfileModel.updateAddress(addressId, req.session.user.id, addressPayload(req.body));
    req.flash('success', 'Alamat berhasil diperbarui.');
    return res.redirect('/profile/addresses');
  } catch (error) {
    return next(error);
  }
}

async function setDefaultAddress(req, res, next) {
  try {
    if (hasValidationErrors(req)) {
      req.flash('error', 'Alamat tidak valid.');
      return res.redirect('/profile/addresses');
    }

    const updated = await customerProfileModel.setDefaultAddress(Number(req.params.id), req.session.user.id);
    req.flash(updated ? 'success' : 'error', updated ? 'Alamat utama berhasil diperbarui.' : 'Alamat tidak ditemukan.');
    return res.redirect('/profile/addresses');
  } catch (error) {
    return next(error);
  }
}

async function deleteAddress(req, res, next) {
  try {
    if (hasValidationErrors(req)) {
      req.flash('error', 'Alamat tidak valid.');
      return res.redirect('/profile/addresses');
    }

    const deleted = await customerProfileModel.deleteAddress(Number(req.params.id), req.session.user.id);
    req.flash(deleted ? 'success' : 'error', deleted ? 'Alamat berhasil dihapus.' : 'Alamat tidak ditemukan.');
    return res.redirect('/profile/addresses');
  } catch (error) {
    if (error.code === 'ADDRESS_USED_BY_ORDER') {
      req.flash('error', error.message);
      return res.redirect('/profile/addresses');
    }

    return next(error);
  }
}

async function editAddress(req, res, next) {
  try {
    if (hasValidationErrors(req)) {
      req.flash('error', 'Alamat tidak valid.');
      return res.redirect('/profile/addresses');
    }

    const addressId = Number(req.params.id);
    const address = await customerProfileModel.findAddressByIdAndUser(addressId, req.session.user.id);

    if (!address) {
      req.flash('error', 'Alamat tidak ditemukan.');
      return res.redirect('/profile/addresses');
    }

    return renderProfilePage(req, res, 'pages/profile/addresses', 'addresses', {
      addressFormMode: 'edit',
      addressFormTarget: `/profile/addresses/${addressId}/update`,
      addressOld: {
        recipient_name: address.recipient_name,
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        postal_code: address.postal_code,
        full_address: address.full_address,
        is_default: address.is_default,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showOverview,
  showInfo,
  showAddresses,
  showOrders,
  showSecurity,
  showProfile: showOverview,
  updateProfile,
  updatePassword,
  createAddress,
  editAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
