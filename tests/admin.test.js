const { loginAsAdmin } = require('./helpers/auth.helper');
const { closePool } = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('admin smoke pages', () => {
  const routes = [
    '/admin/dashboard',
    '/admin/products',
    '/admin/categories',
    '/admin/orders',
    '/admin/inventory',
    '/admin/payments',
    '/admin/reports',
  ];

  test.each(routes)('admin GET %s returns 200', async (route) => {
    const agent = await loginAsAdmin();
    const response = await agent.get(route);
    expect(response.status).toBe(200);
  });
});
