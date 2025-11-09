import { jest } from '@jest/globals';
import request from 'supertest';

process.env.API_KEY_PRIMARY = 'dev-api-key';

const store = new Map();

const queryMock = jest.fn(async (sql, params = []) => {
  if (/SELECT code FROM indices/i.test(sql)) {
    return { rows: [{ code: 'KSE100' }] };
  }
  if (/FROM minute_bars_5m/i.test(sql) && /max\(bucket\)/i.test(sql)) {
    return { rows: [{ bucket: '2025-11-07T10:30:00Z' }] };
  }
  if (/FROM minute_bars_5m/i.test(sql) && /SUM\(CASE WHEN pct_change > 0/i.test(sql)) {
    return {
      rows: [{
        advancers: 5,
        decliners: 3,
        unchanged: 2,
        volume_total: 1234567,
        turnover_total: 7654321
      }]
    };
  }
  if (/FROM sector_performance_5m/i.test(sql)) {
    return {
      rows: [
        {
          sector: 'Power',
          symbols: 2,
          advancers: 1,
          decliners: 1,
          unchanged: 0,
          pct_change: 1.23,
          turnover_sum: 123000,
          volume_sum: 45000
        }
      ]
    };
  }
  if (/ORDER BY pct_change DESC/i.test(sql) || /ORDER BY interval_pct DESC/i.test(sql)) {
    return {
      rows: [
        {
          symbol: 'HUBC',
          close: 100,
          pct_change: 2.5,
          daily_pct: 3.1,
          volume_sum: 10000,
          turnover_sum: 1000000,
          bucket: '2025-11-07T10:30:00Z'
        }
      ]
    };
  }
  if (/ORDER BY pct_change ASC/i.test(sql) || /ORDER BY interval_pct ASC/i.test(sql)) {
    return {
      rows: [
        {
          symbol: 'OGDC',
          close: 80,
          pct_change: -1.2,
          daily_pct: -1.5,
          volume_sum: 5000,
          turnover_sum: 400000,
          bucket: '2025-11-07T10:30:00Z'
        }
      ]
    };
  }
  if (/FROM index_performance_latest/i.test(sql)) {
    return {
      rows: [
        {
          code: 'KSE100',
          name: 'KSE 100 Index',
          bucket: '2025-11-07T10:30:00Z',
          members: 30,
          pct_change: 0.85,
          turnover_sum: 1500000,
          volume_sum: 2000000
        }
      ]
    };
  }
  throw new Error(`Unhandled SQL in mock: ${sql}\nParams: ${JSON.stringify(params)}`);
});

await jest.unstable_mockModule('../../server/api/db.mjs', () => ({
  withClient: async (fn) => fn({ query: queryMock }),
  closePool: jest.fn()
}));

await jest.unstable_mockModule('../../server/api/cache.mjs', () => ({
  redisClient: {
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
}));

await jest.unstable_mockModule('rate-limiter-flexible', () => ({
  RateLimiterRedis: class {
    async consume() { return true; }
  }
}));

const { default: buildApp } = await import('../../server/api/app.mjs');

describe('Market stats endpoints', () => {
  const app = buildApp();

  test('GET /api/market-stats returns aggregated payload', async () => {
    const response = await request(app)
      .get('/api/market-stats?interval=5m')
      .set('x-api-key', 'dev-api-key')
      .expect(200);

    expect(response.body).toMatchObject({
      interval: '5m',
      advancers: 5,
      decliners: 3,
      sectors: expect.any(Array),
      topGainers: expect.any(Array),
      topLosers: expect.any(Array)
    });
    expect(response.body.sectors[0].sector).toBe('Power');
  });

  test('GET /api/market-stats returns 304 when ETag matches', async () => {
    store.set('psx:analytics:version', 'v1');

    const first = await request(app)
      .get('/api/market-stats?interval=5m')
      .set('x-api-key', 'dev-api-key')
      .expect(200);

    const etag = first.headers.etag;
    expect(etag).toBeDefined();

    await request(app)
      .get('/api/market-stats?interval=5m')
      .set('x-api-key', 'dev-api-key')
      .set('If-None-Match', etag)
      .expect(304);
  });

  test('GET /api/market-stats/indices returns index snapshot', async () => {
    const response = await request(app)
      .get('/api/market-stats/indices')
      .set('x-api-key', 'dev-api-key')
      .expect(200);

    expect(response.body.indices).toHaveLength(1);
    expect(response.body.indices[0].code).toBe('KSE100');
  });
});


