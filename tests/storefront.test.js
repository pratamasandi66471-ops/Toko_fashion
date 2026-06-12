const request = require('supertest');
const app = require('./setup/testApp');
const { closePool, getActiveProductSlug } = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('storefront smoke', () => {
  test('GET / returns 200', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
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
