process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'toko_test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

if (process.env.DB_NAME !== 'toko_test') {
  throw new Error(`Refusing to run tests against DB_NAME=${process.env.DB_NAME}. Use toko_test only.`);
}
