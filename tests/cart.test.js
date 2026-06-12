const request = require('supertest');
const app = require('./setup/testApp');
const { TEST_USERS, loginAsCustomer } = require('./helpers/auth.helper');
const {
  cleanupCustomerCartByEmail,
  closePool,
  getActiveVariantWithStock,
  getCartItemByCustomerEmail,
} = require('./helpers/db.helper');

beforeEach(async () => {
  await cleanupCustomerCartByEmail(TEST_USERS.customer.email);
});

afterAll(async () => {
  await cleanupCustomerCartByEmail(TEST_USERS.customer.email);
  await closePool();
});

describe('cart flow', () => {
  test('guest access /cart redirects login', async () => {
    const response = await request(app).get('/cart');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  test('customer access /cart returns 200', async () => {
    const agent = await loginAsCustomer();
    const response = await agent.get('/cart');
    expect(response.status).toBe(200);
  });

  test('customer can add valid variant to cart', async () => {
    const variant = await getActiveVariantWithStock();
    if (!variant) {
      console.warn('Skipping cart add test: no active variant with stock in toko_test.');
      return;
    }

    const agent = await loginAsCustomer();
    const response = await agent
      .post('/cart/add')
      .type('form')
      .send({ product_variant_id: variant.id, quantity: 1 });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/cart');

    const item = await getCartItemByCustomerEmail(TEST_USERS.customer.email);
    expect(item).toBeTruthy();
    expect(Number(item.product_variant_id)).toBe(Number(variant.id));
  });

  test('quantity above stock is rejected or clamped', async () => {
    const variant = await getActiveVariantWithStock();
    if (!variant) {
      console.warn('Skipping stock clamp test: no active variant with stock in toko_test.');
      return;
    }

    const agent = await loginAsCustomer();
    const response = await agent
      .post('/cart/add')
      .type('form')
      .send({ product_variant_id: variant.id, quantity: Number(variant.stock) + 99 });

    expect(response.status).toBe(302);

    const item = await getCartItemByCustomerEmail(TEST_USERS.customer.email);
    expect(item).toBeTruthy();
    expect(Number(item.quantity)).toBeLessThanOrEqual(Number(variant.stock));
  });

  test('customer can update quantity', async () => {
    const variant = await getActiveVariantWithStock();
    if (!variant) {
      console.warn('Skipping cart update test: no active variant with stock in toko_test.');
      return;
    }

    const agent = await loginAsCustomer();
    await agent.post('/cart/add').type('form').send({ product_variant_id: variant.id, quantity: 1 });
    const item = await getCartItemByCustomerEmail(TEST_USERS.customer.email);
    const nextQuantity = Math.min(2, Number(variant.stock));

    const response = await agent
      .patch(`/cart/items/${item.id}`)
      .type('form')
      .send({ quantity: nextQuantity });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/cart');
  });

  test('customer can remove cart item', async () => {
    const variant = await getActiveVariantWithStock();
    if (!variant) {
      console.warn('Skipping cart remove test: no active variant with stock in toko_test.');
      return;
    }

    const agent = await loginAsCustomer();
    await agent.post('/cart/add').type('form').send({ product_variant_id: variant.id, quantity: 1 });
    const item = await getCartItemByCustomerEmail(TEST_USERS.customer.email);

    const response = await agent.delete(`/cart/items/${item.id}`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/cart');
  });
});
