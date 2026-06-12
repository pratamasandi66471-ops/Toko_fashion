const request = require('supertest');
const app = require('../setup/testApp');

const TEST_USERS = {
  admin: { email: 'admin@sfashion.com', password: 'Welcome123!' },
  staff: { email: 'staff@sfashion.com', password: 'Welcome123!' },
  customer: { email: 'dinda.permata@email.com', password: 'Welcome123!' },
};

async function login(agent, credentials, expectedRedirect) {
  const response = await agent
    .post('/login')
    .type('form')
    .send(credentials);

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe(expectedRedirect);
  return response;
}

function createAgent() {
  return request.agent(app);
}

async function loginAsAdmin(agent = createAgent()) {
  await login(agent, TEST_USERS.admin, '/admin/dashboard');
  return agent;
}

async function loginAsStaff(agent = createAgent()) {
  await login(agent, TEST_USERS.staff, '/staff/dashboard');
  return agent;
}

async function loginAsCustomer(agent = createAgent()) {
  await login(agent, TEST_USERS.customer, '/');
  return agent;
}

module.exports = {
  TEST_USERS,
  createAgent,
  loginAsAdmin,
  loginAsStaff,
  loginAsCustomer,
};
