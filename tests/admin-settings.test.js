const { createAgent, loginAsAdmin, loginAsCustomer, loginAsStaff } = require('./helpers/auth.helper');
const { closePool, query, queryOne } = require('./helpers/db.helper');

const DEFAULT_SETTINGS = {
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

async function getSettingsMap() {
  const rows = await query(
    `SELECT s.setting_key, s.setting_value
     FROM settings s
     WHERE s.setting_key IN (?, ?, ?, ?, ?, ?, ?)
     ORDER BY s.setting_key ASC`,
    Object.keys(DEFAULT_SETTINGS)
  );

  return rows.reduce((settings, row) => {
    settings[row.setting_key] = row.setting_value || '';
    return settings;
  }, {});
}

async function updateSetting(key, value) {
  await query(
    `UPDATE settings s
     SET s.setting_value = ?
     WHERE s.setting_key = ?`,
    [value, key]
  );
}

async function restoreSettings(settings) {
  const source = settings || DEFAULT_SETTINGS;
  for (const [key, value] of Object.entries(source)) {
    await updateSetting(key, value);
  }
}

async function getStoreName() {
  const row = await queryOne(
    `SELECT s.setting_value
     FROM settings s
     WHERE s.setting_key = 'store.name'
     LIMIT 1`
  );

  return row?.setting_value || '';
}

describe('admin settings', () => {
  beforeAll(async () => {
    await ensureSettingsTable();
  });

  afterAll(async () => {
    await closePool();
  });

  test('admin GET /admin/settings returns settings page', async () => {
    const agent = await loginAsAdmin();

    const response = await agent.get('/admin/settings');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Website Settings');
    expect(response.text).not.toContain('This admin module is ready for implementation');
  });

  test('admin can update valid settings', async () => {
    const originalSettings = await getSettingsMap();
    const agent = await loginAsAdmin();

    try {
      const response = await agent
        .post('/admin/settings')
        .type('form')
        .send({
          store_name: 'S Fashion Test Store',
          store_email: 'store@example.test',
          store_phone: '+62 812 3456 7890',
          store_address: 'Jl. Testing No. 1',
          instagram_url: 'https://instagram.com/sfashion.test',
          facebook_url: 'https://facebook.com/sfashion.test',
          tiktok_url: 'https://tiktok.com/@sfashion.test',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/settings');

      const settings = await getSettingsMap();
      expect(settings['store.name']).toBe('S Fashion Test Store');
      expect(settings['store.email']).toBe('store@example.test');
      expect(settings['social.instagram']).toBe('https://instagram.com/sfashion.test');
    } finally {
      await restoreSettings(originalSettings);
    }
  });

  test('empty store name is rejected and does not update DB', async () => {
    const originalSettings = await getSettingsMap();
    await updateSetting('store.name', 'Stable Store Name');
    const agent = await loginAsAdmin();

    try {
      const response = await agent
        .post('/admin/settings')
        .type('form')
        .send({
          store_name: '',
          store_email: 'valid@example.test',
          store_phone: '+62 812 3456',
          store_address: '',
          instagram_url: 'https://instagram.com/sfashion',
          facebook_url: '',
          tiktok_url: '',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/settings');
      expect(await getStoreName()).toBe('Stable Store Name');

      const page = await agent.get('/admin/settings');
      expect(page.text).toContain('Store name wajib diisi.');
      expect(page.text).not.toContain('Website settings berhasil diperbarui.');
    } finally {
      await restoreSettings(originalSettings);
    }
  });

  test('invalid email is rejected and does not update DB', async () => {
    const originalSettings = await getSettingsMap();
    await updateSetting('store.name', 'Stable Store Name');
    const agent = await loginAsAdmin();

    try {
      const response = await agent
        .post('/admin/settings')
        .type('form')
        .send({
          store_name: 'Valid Store',
          store_email: 'email-salah',
          store_phone: '+62 812 3456',
          store_address: '',
          instagram_url: '',
          facebook_url: '',
          tiktok_url: '',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/settings');
      expect(await getStoreName()).toBe('Stable Store Name');

      const page = await agent.get('/admin/settings');
      expect(page.text).toContain('Format store email tidak valid.');
      expect(page.text).not.toContain('Website settings berhasil diperbarui.');
    } finally {
      await restoreSettings(originalSettings);
    }
  });

  test('invalid social URL is rejected and does not update DB', async () => {
    const originalSettings = await getSettingsMap();
    await updateSetting('store.name', 'Stable Store Name');
    const agent = await loginAsAdmin();

    try {
      const response = await agent
        .post('/admin/settings')
        .type('form')
        .send({
          store_name: 'Valid Store',
          store_email: '',
          store_phone: '+62 812 3456',
          store_address: '',
          instagram_url: 'instagram.com/sfashion',
          facebook_url: '',
          tiktok_url: '',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/settings');
      expect(await getStoreName()).toBe('Stable Store Name');

      const page = await agent.get('/admin/settings');
      expect(page.text).toContain('Instagram URL harus diawali http:// atau https://.');
      expect(page.text).not.toContain('Website settings berhasil diperbarui.');
    } finally {
      await restoreSettings(originalSettings);
    }
  });

  test('guest, customer, and staff cannot access admin settings', async () => {
    const guestAgent = createAgent();
    const customerAgent = await loginAsCustomer();
    const staffAgent = await loginAsStaff();

    const guestResponse = await guestAgent.get('/admin/settings');
    const customerResponse = await customerAgent.get('/admin/settings');
    const staffResponse = await staffAgent.get('/admin/settings');

    expect(guestResponse.status).toBe(302);
    expect(guestResponse.headers.location).toBe('/login');
    expect([302, 403]).toContain(customerResponse.status);
    expect([302, 403]).toContain(staffResponse.status);
  });
});
