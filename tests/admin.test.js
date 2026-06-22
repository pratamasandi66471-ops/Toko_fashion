const { loginAsAdmin } = require('./helpers/auth.helper');
const {
  closePool,
  ensureTestMarketingContentsTable,
  ensureTestNotificationsTable,
  ensureTestReturnRequestsTable,
  ensureTestShippingMethods,
} = require('./helpers/db.helper');

beforeAll(async () => {
  await ensureTestShippingMethods();
  await ensureTestReturnRequestsTable();
  await ensureTestMarketingContentsTable();
  await ensureTestNotificationsTable();
});

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
    '/admin/shipping',
    '/admin/returns',
    '/admin/promotions',
    '/admin/content',
    '/admin/notifications',
    '/admin/reports',
  ];

  test.each(routes)('admin GET %s returns 200', async (route) => {
    const agent = await loginAsAdmin();
    const response = await agent.get(route);
    expect(response.status).toBe(200);
  });
});
