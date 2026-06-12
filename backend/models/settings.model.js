const db = require('../config/database');

const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_PUBLIC_SETTINGS = Object.freeze({
  'store.name': 'S Fashion',
  'store.email': '',
  'store.phone': '',
  'store.address': '',
  'social.instagram': '',
  'social.facebook': '',
  'social.tiktok': '',
});

let cachedSettings = null;
let cachedAt = 0;

function isMissingSettingsTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function normalizeSettingsRows(rows = []) {
  return rows.reduce((settings, row) => {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_PUBLIC_SETTINGS, row.setting_key)) {
      settings[row.setting_key] = row.setting_value || '';
    }

    return settings;
  }, { ...DEFAULT_PUBLIC_SETTINGS });
}

function toStoreSettings(settingsMap = DEFAULT_PUBLIC_SETTINGS) {
  return {
    name: settingsMap['store.name'] || DEFAULT_PUBLIC_SETTINGS['store.name'],
    email: settingsMap['store.email'] || '',
    phone: settingsMap['store.phone'] || '',
    address: settingsMap['store.address'] || '',
    socials: {
      instagram: settingsMap['social.instagram'] || '',
      facebook: settingsMap['social.facebook'] || '',
      tiktok: settingsMap['social.tiktok'] || '',
    },
  };
}

function clearSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}

async function getPublicSettingsMap({ forceRefresh = false } = {}) {
  const now = Date.now();

  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  try {
    const rows = await db.query(
      `SELECT s.setting_key, s.setting_value
       FROM settings s
       WHERE s.is_public = 1
         AND s.setting_key IN (?, ?, ?, ?, ?, ?, ?)
       ORDER BY s.setting_group ASC, s.setting_key ASC`,
      Object.keys(DEFAULT_PUBLIC_SETTINGS)
    );

    cachedSettings = normalizeSettingsRows(rows);
    cachedAt = now;
    return cachedSettings;
  } catch (error) {
    if (isMissingSettingsTableError(error)) {
      cachedSettings = { ...DEFAULT_PUBLIC_SETTINGS };
      cachedAt = now;
      return cachedSettings;
    }

    throw error;
  }
}

async function getStoreSettings(options = {}) {
  const settingsMap = await getPublicSettingsMap(options);
  return toStoreSettings(settingsMap);
}

module.exports = {
  DEFAULT_PUBLIC_SETTINGS,
  clearSettingsCache,
  getPublicSettingsMap,
  getStoreSettings,
  toStoreSettings,
};
