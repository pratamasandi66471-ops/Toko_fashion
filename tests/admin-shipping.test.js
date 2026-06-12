const { loginAsAdmin } = require('./helpers/auth.helper');
const {
  cleanupShippingMethodByCode,
  closePool,
  createTestMarker,
  ensureTestShippingMethods,
  getShippingMethodByCode,
} = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('admin shipping management', () => {
  beforeAll(async () => {
    await ensureTestShippingMethods();
  });

  test('admin can create, edit, and toggle shipping method', async () => {
    const code = createTestMarker('ship').toLowerCase().replace(/_/g, '-').slice(0, 45);
    const agent = await loginAsAdmin();

    try {
      const createResponse = await agent
        .post('/admin/shipping')
        .type('form')
        .send({
          code,
          name: 'Same Day Test',
          description: 'Shipping method for automated test',
          cost: '45000',
          estimated_days: '1 hari',
          status: 'active',
          sort_order: '30',
        });

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toBe('/admin/shipping');

      let method = await getShippingMethodByCode(code);
      expect(method).toBeTruthy();
      expect(method.name).toBe('Same Day Test');
      expect(Number(method.cost)).toBe(45000);
      expect(method.status).toBe('active');

      const editPage = await agent.get(`/admin/shipping/${method.id}/edit`);
      expect(editPage.status).toBe(200);
      expect(editPage.text).toContain('Same Day Test');

      const updateResponse = await agent
        .post(`/admin/shipping/${method.id}/update`)
        .type('form')
        .send({
          code,
          name: 'Same Day Updated',
          description: 'Updated shipping method',
          cost: '50000',
          estimated_days: 'Hari ini',
          status: 'active',
          sort_order: '31',
        });

      expect(updateResponse.status).toBe(302);
      expect(updateResponse.headers.location).toBe('/admin/shipping');

      method = await getShippingMethodByCode(code);
      expect(method.name).toBe('Same Day Updated');
      expect(Number(method.cost)).toBe(50000);

      const toggleResponse = await agent.post(`/admin/shipping/${method.id}/toggle-status`);
      expect(toggleResponse.status).toBe(302);
      expect(toggleResponse.headers.location).toBe('/admin/shipping');

      method = await getShippingMethodByCode(code);
      expect(method.status).toBe('inactive');
    } finally {
      await cleanupShippingMethodByCode(code);
    }
  });

  test('admin cannot create duplicate shipping code', async () => {
    const agent = await loginAsAdmin();

    const response = await agent
      .post('/admin/shipping')
      .type('form')
      .send({
        code: 'regular',
        name: 'Duplicate Regular',
        description: '',
        cost: '10000',
        estimated_days: '2 hari',
        status: 'active',
        sort_order: '99',
      });

    expect(response.status).toBe(422);
    expect(response.text).toContain('Kode shipping sudah dipakai.');
  });
});
