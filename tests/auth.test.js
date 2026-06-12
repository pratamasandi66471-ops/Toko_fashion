const request = require('supertest');
const app = require('./setup/testApp');
const { TEST_USERS, createAgent, loginAsAdmin, loginAsCustomer, loginAsStaff } = require('./helpers/auth.helper');
const { closePool } = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('auth flow', () => {
  test('GET /login returns 200', async () => {
    const response = await request(app).get('/login');
    expect(response.status).toBe(200);
  });

  test('POST /login admin redirects to admin dashboard', async () => {
    const agent = createAgent();
    const response = await agent.post('/login').type('form').send(TEST_USERS.admin);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin/dashboard');
  });

  test('POST /login staff redirects to staff dashboard', async () => {
    const agent = createAgent();
    const response = await agent.post('/login').type('form').send(TEST_USERS.staff);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/staff/dashboard');
  });

  test('POST /login customer redirects home', async () => {
    const agent = createAgent();
    const response = await agent.post('/login').type('form').send(TEST_USERS.customer);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/');
  });

  test('wrong password renders login error', async () => {
    const response = await request(app)
      .post('/login')
      .type('form')
      .send({ email: TEST_USERS.admin.email, password: 'WrongPassword123!' });

    expect(response.status).toBe(401);
    expect(response.text).toContain('Email atau password salah.');
  });

  test('guest cannot access admin dashboard', async () => {
    const response = await request(app).get('/admin/dashboard');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  test('customer cannot access admin dashboard', async () => {
    const agent = await loginAsCustomer();
    const response = await agent.get('/admin/dashboard');
    expect(response.status).toBe(403);
  });

  test('staff cannot access admin dashboard', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get('/admin/dashboard');
    expect(response.status).toBe(403);
  });

  test('admin can access admin dashboard', async () => {
    const agent = await loginAsAdmin();
    const response = await agent.get('/admin/dashboard');
    expect(response.status).toBe(200);
  });
});
