module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  setupFiles: ['<rootDir>/tests/setup/testEnv.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  testTimeout: 30000,
};
