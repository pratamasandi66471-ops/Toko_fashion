const db = require('../config/database');

const ALLOWED_SETTING_KEYS = Object.freeze([
  'store.name',
  'store.email',
  'store.phone',
  'store.address',
  'social.instagram',
  'social.facebook',
  'social.tiktok',
]);

function normalizeGroups(groups = []) {
  return [...new Set(groups.map((group) => String(group || '').trim()).filter(Boolean))];
}

function normalizeSettingsMap(settingsMap = {}) {
  return ALLOWED_SETTING_KEYS.reduce((safeMap, key) => {
    if (Object.prototype.hasOwnProperty.call(settingsMap, key)) {
      safeMap[key] = String(settingsMap[key] ?? '').trim();
    }

    return safeMap;
  }, {});
}

async function getSettingsByGroups(groups = []) {
  const safeGroups = normalizeGroups(groups);
  if (safeGroups.length === 0) return [];

  const placeholders = safeGroups.map(() => '?').join(', ');
  return db.query(
    `SELECT s.id, s.setting_key, s.setting_value, s.setting_group,
            s.value_type, s.is_public, s.created_at, s.updated_at
     FROM settings s
     WHERE s.setting_group IN (${placeholders})
     ORDER BY s.setting_group ASC, s.setting_key ASC`,
    safeGroups
  );
}

async function getSettingsMap(groups = []) {
  const rows = await getSettingsByGroups(groups);

  return rows.reduce((settings, row) => {
    settings[row.setting_key] = row.setting_value || '';
    return settings;
  }, {});
}

async function updateSettings(settingsMap = {}) {
  const safeSettings = normalizeSettingsMap(settingsMap);
  const entries = Object.entries(safeSettings);
  if (entries.length === 0) return 0;

  const connection = await db.pool.getConnection();

  try {
    await connection.beginTransaction();

    let affectedRows = 0;
    for (const [key, value] of entries) {
      const [result] = await connection.execute(
        `UPDATE settings s
         SET s.setting_value = ?
         WHERE s.setting_key = ?`,
        [value, key]
      );
      affectedRows += result.affectedRows;
    }

    await connection.commit();
    return affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  ALLOWED_SETTING_KEYS,
  getSettingsByGroups,
  getSettingsMap,
  updateSettings,
};
