import { jest } from '@jest/globals';
import request from 'supertest';

process.env.API_KEY_PRIMARY = 'dev-api-key';

const sampleRows = [
  { symbol: 'HUBC', bucket: new Date().toISOString(), price: 100, interval_pct: 2.5, daily_pct: 4, volume: 10000, value: 1000000 },
  { symbol: 'OGDC', bucket: new Date().toISOString(), price: 80, interval_pct: -1.2, daily_pct: -1.5, volume: 5000, value: 400000 }
];

await jest.unstable_mockModule('../../server/api/db.mjs', () => ({
  withClient: async (fn) => fn({ query: async () => ({ rows: sampleRows }) }),
  closePool: jest.fn()
}));

await jest.unstable_mockModule('../../server/api/cache.mjs', () => {
  const store = new Map();
  return {
    redisClient: {
      incr: jest.fn(),
      incrby: jest.fn(),
      multi: jest.fn(() => ({ exec: jest.fn(async () => []) })),
      get: jest.fn(async (key) => store.get(key) ?? null),
      set: jest.fn(async (key, value) => store.set(key, value)),
      quit: jest.fn(async () => {})
    },
    getCache: jest.fn(async (key) => {
      const value = store.get(key);
      return value ? JSON.parse(value) : null;
    }),
    setCache: jest.fn(async (key, value) => {
      store.set(key, JSON.stringify(value));
    }),
    quit: jest.fn(async () => {})
  };
});

await jest.unstable_mockModule('rate-limiter-flexible', () => ({
  RateLimiterRedis: class {
    async consume() {
      return true;
    }
  }
}));

const { default: buildApp } = await import('../../server/api/app.mjs');

describe('GET /api/bubbles', () => {
  const app = buildApp();

  test('returns normalized payload', async () => {
    const response = await request(app)
      .get('/api/bubbles')
      .set('x-api-key', 'dev-api-key')
      .expect(200);

    expect(response.body.interval).toBe('Day');
    expect(response.body.symbols).toHaveLength(2);
    expect(response.body.symbols[0]).toHaveProperty('price');
  });
});

