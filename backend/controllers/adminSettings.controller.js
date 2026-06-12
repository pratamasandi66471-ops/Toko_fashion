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
    storeName: String(body.store_name || '').trim(),
    storeEmail: String(body.store_email || '').trim(),
    storePhone: String(body.store_phone || '').trim(),
    storeAddress: String(body.store_address || '').trim(),
    instagramUrl: String(body.instagram_url || '').trim(),
    facebookUrl: String(body.facebook_url || '').trim(),
    tiktokUrl: String(body.tiktok_url || '').trim(),
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

  if (!payload.storeName) {
    errors.push('Store name wajib diisi.');
  } else if (payload.storeName.length < 2) {
    errors.push('Store name minimal 2 karakter.');
  } else if (payload.storeName.length > 100) {
    errors.push('Store name maksimal 100 karakter.');
  }

  if (payload.storeEmail && !isValidEmail(payload.storeEmail)) {
    errors.push('Format store email tidak valid.');
  }

  if (payload.storePhone && payload.storePhone.length > 30) {
    errors.push('Nomor telepon maksimal 30 karakter.');
  }

  if (payload.storePhone && !/^[0-9+\-\s]+$/.test(payload.storePhone)) {
    errors.push('Nomor telepon hanya boleh berisi angka, spasi, +, atau -.');
  }

  if (payload.storeAddress && payload.storeAddress.length > 500) {
    errors.push('Alamat toko maksimal 500 karakter.');
  }

  [
    ['Instagram URL', payload.instagramUrl],
    ['Facebook URL', payload.facebookUrl],
    ['TikTok URL', payload.tiktokUrl],
  ].forEach(([label, value]) => {
    if (value && !isValidHttpUrl(value)) {
      errors.push(`${label} harus diawali http:// atau https://.`);
    }
  });

  return errors;
}

function mapPayloadToSettings(payload) {
  return {
    'store.name': payload.storeName,
    'store.email': payload.storeEmail,
    'store.phone': payload.storePhone,
    'store.address': payload.storeAddress,
    'social.instagram': payload.instagramUrl,
    'social.facebook': payload.facebookUrl,
    'social.tiktok': payload.tiktokUrl,
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
