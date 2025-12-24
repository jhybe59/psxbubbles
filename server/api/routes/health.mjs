import { Router } from 'express';
import { withClient } from '../db.mjs';
import { redisClient } from '../cache.mjs';

const router = Router();

router.get('/', async (_req, res) => {
  const [timescaleResult, redisResult] = await Promise.allSettled([
    withClient(async (client) => {
      const result = await client.query('SELECT max(timestamp) AS latest_ts FROM trades');
      return result.rows[0]?.latest_ts;
    }),
    redisClient.ping()
  ]);

  const payload = {
    status: 'ok',
    timescale: {
      status: 'ok',
      latestTs: null,
      lagSeconds: null
    },
    redis: {
      status: 'ok'
    }
  };

  if (timescaleResult.status === 'fulfilled') {
    const latest = timescaleResult.value;
    payload.timescale.latestTs = latest;
    payload.timescale.lagSeconds = latest ? Math.max(0, (Date.now() - new Date(latest).getTime()) / 1000) : null;
  } else {
    payload.status = 'degraded';
    payload.timescale.status = 'error';
    payload.timescale.error = timescaleResult.reason?.message || 'Timescale query failed';
  }

  if (redisResult.status === 'fulfilled' && redisResult.value === 'PONG') {
    payload.redis.status = 'ok';
  } else {
    payload.status = 'degraded';
    payload.redis.status = 'error';
    payload.redis.error = redisResult.status === 'rejected'
      ? redisResult.reason?.message || 'Redis ping failed'
      : `Unexpected response: ${redisResult.value}`;
  }

  res.status(payload.status === 'ok' ? 200 : 503).json(payload);
});

router.get('/live', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;

