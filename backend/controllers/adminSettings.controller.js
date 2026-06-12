const adminSettingsModel = require('../models/adminSettings.model');
const settingsModel = require('../models/settings.model');
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

function parseHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch (_error) {
    return null;
  }
}

function isValidDomainHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host || host.length > 253) return false;
  if (host === 'localhost' || host.includes('_') || !host.includes('.')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;

  return host.split('.').every((part) => (
    part.length > 0
    && part.length <= 63
    && /^[a-z0-9-]+$/.test(part)
    && !part.startsWith('-')
    && !part.endsWith('-')
  ));
}

function isAllowedPlatformHost(hostname, allowedDomains = []) {
  const host = String(hostname || '').toLowerCase();

  return allowedDomains.some((domain) => (
    host === domain || host.endsWith(`.${domain}`)
  ));
}

function validateSocialUrl(label, value, allowedDomains) {
  if (!value) return null;

  const url = parseHttpUrl(value);
  if (!url) {
    return `${label} harus diawali http:// atau https://.`;
  }

  if (!isValidDomainHost(url.hostname)) {
    return `${label} harus menggunakan domain yang valid.`;
  }

  if (!isAllowedPlatformHost(url.hostname, allowedDomains)) {
    return `${label} harus menggunakan domain ${allowedDomains.join(' atau ')}.`;
  }

  return null;
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
    ['Instagram URL', payload.instagramUrl, ['instagram.com']],
    ['Facebook URL', payload.facebookUrl, ['facebook.com', 'fb.com']],
    ['TikTok URL', payload.tiktokUrl, ['tiktok.com']],
  ].forEach(([label, value, allowedDomains]) => {
    const error = validateSocialUrl(label, value, allowedDomains);
    if (error) errors.push(error);
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
    settingsModel.clearSettingsCache();

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
