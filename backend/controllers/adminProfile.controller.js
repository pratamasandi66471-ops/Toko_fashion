const adminProfileModel = require('../models/adminProfile.model');
const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    pageTitle: 'Admin Profile',
    activeMenu: 'profile',
    pageStyles: ['/css/admin/pages/profile.css'],
    currentDateWib: getWibDateLabel(),
  };
}

function sanitizeAdminProfile(adminProfile) {
  if (!adminProfile) return null;

  const { password, ...safeProfile } = adminProfile;
  return safeProfile;
}

function normalizeProfilePayload(body) {
  return {
    name: String(body.name || '').trim(),
    phone: String(body.phone || '').trim(),
  };
}

function validateProfilePayload(payload) {
  const errors = [];

  if (!payload.name) {
    errors.push('Nama wajib diisi.');
  } else if (payload.name.length < 2) {
    errors.push('Nama minimal 2 karakter.');
  } else if (payload.name.length > 100) {
    errors.push('Nama maksimal 100 karakter.');
  }

  if (payload.phone && payload.phone.length > 30) {
    errors.push('Nomor telepon maksimal 30 karakter.');
  }

  if (payload.phone && !/^[0-9+\-\s()]+$/.test(payload.phone)) {
    errors.push('Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung.');
  }

  return errors;
}

function normalizePasswordPayload(body) {
  return {
    currentPassword: String(body.current_password || ''),
    newPassword: String(body.new_password || ''),
    confirmPassword: String(body.confirm_password || ''),
  };
}

function validatePasswordPayload(payload) {
  const errors = [];

  if (!payload.currentPassword) {
    errors.push('Password saat ini wajib diisi.');
  }

  if (!payload.newPassword || payload.newPassword.length < 8) {
    errors.push('Password baru minimal 8 karakter.');
  }

  if (payload.newPassword !== payload.confirmPassword) {
    errors.push('Konfirmasi password tidak sama.');
  }

  if (payload.currentPassword && payload.newPassword && payload.currentPassword === payload.newPassword) {
    errors.push('Password baru tidak boleh sama dengan password saat ini.');
  }

  return errors;
}

async function getProfileOrRedirect(req, res) {
  const adminId = req.session?.user?.id;

  if (!adminId) {
    req.flash('error', 'Silakan login terlebih dahulu.');
    res.redirect('/login');
    return null;
  }

  const adminProfile = await adminProfileModel.getAdminProfile(adminId);
  if (!adminProfile) {
    req.flash('error', 'Profil admin tidak ditemukan.');
    res.redirect('/admin/dashboard');
    return null;
  }

  return adminProfile;
}

async function showProfile(req, res, next) {
  try {
    const adminProfile = await getProfileOrRedirect(req, res);
    if (!adminProfile) return null;

    return res.render('admin/profile/index', {
      ...getBaseRenderData(),
      adminProfile: sanitizeAdminProfile(adminProfile),
      profileOld: null,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const adminId = req.session?.user?.id;
    const payload = normalizeProfilePayload(req.body);
    const errors = validateProfilePayload(payload);

    if (errors.length > 0) {
      errors.forEach((message) => req.flash('error', message));
      return res.redirect('/admin/profile');
    }

    const adminProfile = await getProfileOrRedirect(req, res);
    if (!adminProfile) return null;

    const updated = await adminProfileModel.updateAdminProfile(adminId, payload);
    if (!updated) {
      req.flash('error', 'Profil admin gagal diperbarui.');
      return res.redirect('/admin/profile');
    }

    if (req.session?.user) {
      req.session.user.name = payload.name;
    }

    await auditService.logActivity(req, {
      action: 'ADMIN_PROFILE_UPDATED',
      entityType: 'users',
      entityId: adminId,
      oldValues: {
        name: adminProfile.name,
        phone: adminProfile.phone,
      },
      newValues: payload,
    });

    req.flash('success', 'Profil admin berhasil diperbarui.');
    return res.redirect('/admin/profile');
  } catch (error) {
    return next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    const adminId = req.session?.user?.id;
    const payload = normalizePasswordPayload(req.body);
    const errors = validatePasswordPayload(payload);

    if (errors.length > 0) {
      errors.forEach((message) => req.flash('error', message));
      return res.redirect('/admin/profile');
    }

    const adminProfile = await getProfileOrRedirect(req, res);
    if (!adminProfile) return null;

    const isCurrentPasswordValid = await authService.verifyPassword(
      payload.currentPassword,
      adminProfile.password,
    );

    if (!isCurrentPasswordValid) {
      req.flash('error', 'Password saat ini salah.');
      return res.redirect('/admin/profile');
    }

    const passwordHash = await authService.hashPassword(payload.newPassword);
    const updated = await adminProfileModel.updateAdminPassword(adminId, passwordHash);

    if (!updated) {
      req.flash('error', 'Password gagal diperbarui.');
      return res.redirect('/admin/profile');
    }

    await auditService.logActivity(req, {
      action: 'ADMIN_PASSWORD_UPDATED',
      entityType: 'users',
      entityId: adminId,
      oldValues: null,
      newValues: {
        password_changed: true,
      },
    });

    req.flash('success', 'Password admin berhasil diperbarui.');
    return res.redirect('/admin/profile');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showProfile,
  updateProfile,
  updatePassword,
};
