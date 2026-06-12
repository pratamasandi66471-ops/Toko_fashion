const { TEST_USERS, loginAsAdmin, loginAsCustomer, loginAsStaff } = require('./helpers/auth.helper');
const {
  closePool,
  createTestMarker,
  getCustomerByEmail,
  query,
  queryOne,
} = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('customer profile self-service', () => {
  test('customer can access profile dashboard pages', async () => {
    const agent = await loginAsCustomer();
    const paths = ['/profile', '/profile/info', '/profile/addresses', '/profile/orders', '/profile/security'];

    for (const path of paths) {
      const response = await agent.get(path);
      expect(response.status).toBe(200);
      expect(response.text).toContain('Customer Account');
      expect(response.text).toContain(TEST_USERS.customer.email);
    }
  });

  test('admin and staff cannot access customer profile pages', async () => {
    const adminAgent = await loginAsAdmin();
    const staffAgent = await loginAsStaff();

    for (const path of ['/profile', '/profile/orders']) {
      const adminResponse = await adminAgent.get(path);
      const staffResponse = await staffAgent.get(path);
      expect(adminResponse.status).toBe(403);
      expect(staffResponse.status).toBe(403);
    }
  });

  test('customer can update profile name and phone', async () => {
    const customer = await getCustomerByEmail(TEST_USERS.customer.email);
    expect(customer).toBeTruthy();

    const nextName = 'Dinda Permata Test';
    const nextPhone = '089900001111';

    try {
      const agent = await loginAsCustomer();
      const response = await agent
        .post('/profile')
        .type('form')
        .send({ name: nextName, phone: nextPhone });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/profile/info');

      const updatedCustomer = await getCustomerByEmail(TEST_USERS.customer.email);
      expect(updatedCustomer.name).toBe(nextName);
      expect(updatedCustomer.phone).toBe(nextPhone);
    } finally {
      await query(
        `UPDATE users u
         SET u.name = ?,
             u.phone = ?
         WHERE u.id = ?
           AND u.role = 'customer'`,
        [customer.name, customer.phone, customer.id]
      );
    }
  });

  test('wrong current password is rejected without changing password', async () => {
    const agent = await loginAsCustomer();
    const response = await agent
      .post('/profile/password')
      .type('form')
      .send({
        current_password: 'WrongPassword123!',
        new_password: 'Welcome12345!',
        confirm_password: 'Welcome12345!',
      });

    expect(response.status).toBe(422);
    expect(response.text).toContain('Password saat ini tidak sesuai.');
  });

  test('customer can create, edit, set default, and delete an unused address', async () => {
    const customer = await getCustomerByEmail(TEST_USERS.customer.email);
    expect(customer).toBeTruthy();

    const marker = createTestMarker('PROFILE_ADDRESS');
    const editedMarker = `${marker}_EDITED`;
    let addressId = null;

    try {
      const agent = await loginAsCustomer();
      const createResponse = await agent
        .post('/profile/addresses')
        .type('form')
        .send({
          recipient_name: 'Profile Test',
          phone: '081200009999',
          province: 'DKI Jakarta',
          city: 'Jakarta Selatan',
          district: 'Kebayoran Baru',
          postal_code: '12110',
          full_address: marker,
          is_default: 'on',
        });

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toBe('/profile/addresses');

      const createdAddress = await queryOne(
        `SELECT a.id, a.full_address, a.is_default
         FROM addresses a
         WHERE a.user_id = ?
           AND a.full_address = ?
         LIMIT 1`,
        [customer.id, marker]
      );

      expect(createdAddress).toBeTruthy();
      addressId = createdAddress.id;
      expect(Number(createdAddress.is_default)).toBe(1);

      const editResponse = await agent
        .post(`/profile/addresses/${addressId}/update`)
        .type('form')
        .send({
          recipient_name: 'Profile Test Edited',
          phone: '081200008888',
          province: 'Jawa Barat',
          city: 'Bandung',
          district: 'Coblong',
          postal_code: '40135',
          full_address: editedMarker,
          is_default: 'on',
        });

      expect(editResponse.status).toBe(302);
      expect(editResponse.headers.location).toBe('/profile/addresses');

      const editedAddress = await queryOne(
        `SELECT a.id, a.recipient_name, a.full_address
         FROM addresses a
         WHERE a.id = ?
           AND a.user_id = ?
         LIMIT 1`,
        [addressId, customer.id]
      );

      expect(editedAddress.recipient_name).toBe('Profile Test Edited');
      expect(editedAddress.full_address).toBe(editedMarker);

      const defaultResponse = await agent.post(`/profile/addresses/${addressId}/default`).type('form').send({});
      expect(defaultResponse.status).toBe(302);
      expect(defaultResponse.headers.location).toBe('/profile/addresses');

      const deleteResponse = await agent.post(`/profile/addresses/${addressId}/delete`).type('form').send({});
      expect(deleteResponse.status).toBe(302);
      expect(deleteResponse.headers.location).toBe('/profile/addresses');

      const deletedAddress = await queryOne(
        `SELECT a.id
         FROM addresses a
         WHERE a.id = ?
         LIMIT 1`,
        [addressId]
      );
      expect(deletedAddress).toBeNull();
      addressId = null;
    } finally {
      if (addressId) {
        await query(
          `DELETE a
           FROM addresses a
           WHERE a.id = ?
             AND a.user_id = ?
             AND (a.full_address = ? OR a.full_address = ?)`,
          [addressId, customer.id, marker, editedMarker]
        );
      }
    }
  });
});
