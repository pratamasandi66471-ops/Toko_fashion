const { createAgent, loginAsAdmin, loginAsCustomer, loginAsStaff } = require('./helpers/auth.helper');
const { closePool, queryOne, query } = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

async function getAdminUser() {
  return queryOne(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.status
     FROM users u
     WHERE u.email = ?
     LIMIT 1`,
    ['admin@sfashion.com']
  );
}

describe('admin profile', () => {
  test('admin can open profile page', async () => {
    const agent = await loginAsAdmin();

    const response = await agent.get('/admin/profile');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Admin Profile');
    expect(response.text).toContain('admin@sfashion.com');
    expect(response.text).not.toContain('This admin module is ready for implementation');
  });

  test('guest is redirected from admin profile', async () => {
    const agent = createAgent();

    const response = await agent.get('/admin/profile');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  test('customer and staff cannot access admin profile', async () => {
    const customerAgent = await loginAsCustomer();
    const staffAgent = await loginAsStaff();

    const customerResponse = await customerAgent.get('/admin/profile');
    const staffResponse = await staffAgent.get('/admin/profile');

    expect([302, 403]).toContain(customerResponse.status);
    expect([302, 403]).toContain(staffResponse.status);
  });

  test('admin can update own name and phone', async () => {
    const admin = await getAdminUser();
    const agent = await loginAsAdmin();
    const testName = `Admin Demo ${Date.now()}`;
    const testPhone = '+62 811 0000 999';

    try {
      const response = await agent
        .post('/admin/profile')
        .type('form')
        .send({
          name: testName,
          phone: testPhone,
          email: 'malicious@example.com',
          role: 'customer',
          status: 'blocked',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/profile');

      const updatedAdmin = await getAdminUser();
      expect(updatedAdmin.name).toBe(testName);
      expect(updatedAdmin.phone).toBe(testPhone);
      expect(updatedAdmin.email).toBe('admin@sfashion.com');
      expect(updatedAdmin.role).toBe('admin');
      expect(updatedAdmin.status).toBe('active');
    } finally {
      await query(
        `UPDATE users u
         SET u.name = ?,
             u.phone = ?
         WHERE u.id = ?
           AND u.role = 'admin'`,
        [admin.name, admin.phone, admin.id]
      );
    }
  });

  test('wrong current password is rejected', async () => {
    const agent = await loginAsAdmin();

    const response = await agent
      .post('/admin/profile/password')
      .type('form')
      .send({
        current_password: 'WrongPassword123!',
        new_password: 'Welcome12345!',
        confirm_password: 'Welcome12345!',
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin/profile');
  });
});
