const request = require('supertest');
const app = require('./setup/testApp');
const settingsModel = require('../backend/models/settings.model');
const { closePool, getActiveProductSlug, query } = require('./helpers/db.helper');

const SETTINGS_KEYS = {
  'store.name': 'S Fashion',
  'store.email': '',
  'store.phone': '',
  'store.address': '',
  'social.instagram': '',
  'social.facebook': '',
  'social.tiktok': '',
};

async function ensureSettingsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      setting_group VARCHAR(50) NOT NULL DEFAULT 'general',
      value_type ENUM('string', 'text', 'boolean', 'number', 'json') NOT NULL DEFAULT 'string',
      is_public TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await query(
    `INSERT INTO settings
      (setting_key, setting_value, setting_group, value_type, is_public)
     VALUES
      ('store.name', 'S Fashion', 'store', 'string', 1),
      ('store.email', '', 'store', 'string', 1),
      ('store.phone', '', 'store', 'string', 1),
      ('store.address', '', 'store', 'text', 1),
      ('social.instagram', '', 'social', 'string', 1),
      ('social.facebook', '', 'social', 'string', 1),
      ('social.tiktok', '', 'social', 'string', 1)
     ON DUPLICATE KEY UPDATE
      setting_key = VALUES(setting_key)`
  );
}

async function getSettingsSnapshot() {
  const rows = await query(
    `SELECT s.setting_key, s.setting_value
     FROM settings s
     WHERE s.setting_key IN (?, ?, ?, ?, ?, ?, ?)`,
    Object.keys(SETTINGS_KEYS)
  );

  return rows.reduce((settings, row) => {
    settings[row.setting_key] = row.setting_value || '';
    return settings;
  }, { ...SETTINGS_KEYS });
}

async function restoreSettings(snapshot) {
  for (const [key, value] of Object.entries(snapshot || SETTINGS_KEYS)) {
    await query(
      `UPDATE settings s
       SET s.setting_value = ?
       WHERE s.setting_key = ?`,
      [value, key]
    );
  }
}

async function updateSetting(key, value) {
  await query(
    `UPDATE settings s
     SET s.setting_value = ?
     WHERE s.setting_key = ?`,
    [value, key]
  );
}

afterAll(async () => {
  await closePool();
});

describe('storefront smoke', () => {
  test('GET / returns 200', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  test('navbar and footer render public store settings from DB', async () => {
    await ensureSettingsTable();
    const snapshot = await getSettingsSnapshot();

    try {
      await updateSetting('store.name', 'S Fashion Public Test');
      await updateSetting('store.email', 'public@example.test');
      await updateSetting('store.phone', '+62 811 2222 3333');
      await updateSetting('store.address', 'Public Test Street');
      await updateSetting('social.instagram', 'https://instagram.com/sfashion.public');
      settingsModel.clearSettingsCache();

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.text).toContain('S <span>Fashion Public Test</span>');
      expect(response.text).toContain('public@example.test');
      expect(response.text).toContain('+62 811 2222 3333');
      expect(response.text).toContain('Public Test Street');
      expect(response.text).toContain('https://instagram.com/sfashion.public');
    } finally {
      await restoreSettings(snapshot);
      settingsModel.clearSettingsCache();
    }
  });

  test('GET /shop returns 200', async () => {
    const response = await request(app).get('/shop');
    expect(response.status).toBe(200);
  });

  test('GET /shop?q=dress returns 200', async () => {
    const response = await request(app).get('/shop?q=dress');
    expect(response.status).toBe(200);
  });

  test('GET /shop?sort=price_low returns 200', async () => {
    const response = await request(app).get('/shop?sort=price_low');
    expect(response.status).toBe(200);
  });

  test('GET /shop/:slug for active product returns 200', async () => {
    const slug = await getActiveProductSlug();
    if (!slug) {
      console.warn('Skipping active product detail test: no active product with stock in toko_test.');
      return;
    }

    const response = await request(app).get(`/shop/${slug}`);
    expect(response.status).toBe(200);
  });

  test('GET /shop/slug-tidak-ada redirects or returns not found', async () => {
    const response = await request(app).get('/shop/slug-tidak-ada');
    expect([302, 404]).toContain(response.status);
  });
});
