module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.jsx'],
  moduleNameMapper: {
    '\\.(css|less|scss|svg)$': '<rootDir>/tests/mocks/fileMock.js'
  },
  setupFiles: ['fake-indexeddb/auto'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx'
  ]
};

