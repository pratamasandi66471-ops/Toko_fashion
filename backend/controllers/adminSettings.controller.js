const adminSettingsModel = require('../models/adminSettings.model');
const auditService = require('../services/audit.service');

const SETTINGS_GROUPS = ['store', 'social'];

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
    pageTitle: 'Admin Settings',
    activeMenu: 'settings',
    pageStyles: ['/css/admin/pages/settings.css'],
    currentDateWib: getWibDateLabel(),
  };
}

function normalizeSettingsPayload(body = {}) {
  return {
    store_name: String(body.store_name || '').trim(),
    store_email: String(body.store_email || '').trim(),
    store_phone: String(body.store_phone || '').trim(),
    store_address: String(body.store_address || '').trim(),
    instagram_url: String(body.instagram_url || '').trim(),
    facebook_url: String(body.facebook_url || '').trim(),
    tiktok_url: String(body.tiktok_url || '').trim(),
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function validateSettingsPayload(payload) {
  const errors = [];

  if (!payload.store_name) {
    errors.push('Nama toko wajib diisi.');
  } else if (payload.store_name.length < 2) {
    errors.push('Nama toko minimal 2 karakter.');
  } else if (payload.store_name.length > 100) {
    errors.push('Nama toko maksimal 100 karakter.');
  }

  if (payload.store_email && !isValidEmail(payload.store_email)) {
    errors.push('Email toko tidak valid.');
  }

  if (payload.store_phone && payload.store_phone.length > 30) {
    errors.push('Nomor telepon maksimal 30 karakter.');
  }

  if (payload.store_phone && !/^[0-9+\-\s()]+$/.test(payload.store_phone)) {
    errors.push('Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung.');
  }

  if (payload.store_address.length > 500) {
    errors.push('Alamat toko maksimal 500 karakter.');
  }

  [
    ['instagram_url', 'Instagram URL'],
    ['facebook_url', 'Facebook URL'],
    ['tiktok_url', 'TikTok URL'],
  ].forEach(([key, label]) => {
    if (payload[key] && !isValidHttpUrl(payload[key])) {
      errors.push(`${label} harus diawali http:// atau https://.`);
    }
  });

  return errors;
}

function mapPayloadToSettings(payload) {
  return {
    'store.name': payload.store_name,
    'store.email': payload.store_email,
    'store.phone': payload.store_phone,
    'store.address': payload.store_address,
    'social.instagram': payload.instagram_url,
    'social.facebook': payload.facebook_url,
    'social.tiktok': payload.tiktok_url,
  };
}

async function showSettings(req, res, next) {
  try {
    const settings = await adminSettingsModel.getSettingsMap(SETTINGS_GROUPS);

    return res.render('admin/settings/index', {
      ...getBaseRenderData(),
      settings,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const payload = normalizeSettingsPayload(req.body);
    const errors = validateSettingsPayload(payload);

    if (errors.length > 0) {
      errors.forEach((message) => req.flash('error', message));
      return res.redirect('/admin/settings');
    }

    const oldSettings = await adminSettingsModel.getSettingsMap(SETTINGS_GROUPS);
    const newSettings = mapPayloadToSettings(payload);

    await adminSettingsModel.updateSettings(newSettings);

    await auditService.logActivity(req, {
      action: 'ADMIN_SETTINGS_UPDATED',
      entityType: 'settings',
      entityId: null,
      oldValues: oldSettings,
      newValues: newSettings,
    });

    req.flash('success', 'Website settings berhasil diperbarui.');
    return res.redirect('/admin/settings');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showSettings,
  updateSettings,
};
