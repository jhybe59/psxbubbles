const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: ['**/tests/integration/**/*.test.js']
};

