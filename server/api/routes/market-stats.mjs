import { Router } from 'express';
import { z } from 'zod';
import {
  getAnalyticsVersion,
  getMarketStats,
  getIndicesSnapshot
} from '../services/analytics.mjs';

const router = Router();

const schema = z.object({
  interval: z.enum(['5m', 'Day']).default('5m'),
  index: z.string().nullable().optional()
});

router.get('/', async (req, res, next) => {
  try {
    const parsed = schema.parse({
      interval: req.query.interval,
      index: req.query.index ?? null
    });

    const version = await getAnalyticsVersion();
    const etag = version
      ? `"${parsed.interval}-${parsed.index ? parsed.index : 'ALL'}-${version}"`
      : null;

    if (etag && req.headers['if-none-match'] && req.headers['if-none-match'].split(',').map((s) => s.trim()).includes(etag)) {
      res.status(304).set('ETag', etag).end();
      return;
    }

    const payload = await getMarketStats(parsed.interval, parsed.index || undefined);
    if (!payload) {
      res.status(204).send();
      return;
    }

    if (etag) {
      res.set('ETag', etag);
    }

    res.set('Cache-Control', parsed.interval === 'Day' ? 'public, max-age=60' : 'private, max-age=5');

    res.json(payload);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'INVALID_PARAMS', message: err.message } });
      return;
    }
    next(err);
  }
});

router.get('/indices', async (req, res, next) => {
  try {
    const version = await getAnalyticsVersion();
    const etag = version ? `"indices-${version}"` : null;
    if (etag && req.headers['if-none-match'] && req.headers['if-none-match'].split(',').map((s) => s.trim()).includes(etag)) {
      res.status(304).set('ETag', etag).end();
      return;
    }
    const snapshot = await getIndicesSnapshot();
    if (etag) {
      res.set('ETag', etag);
    }
    res.set('Cache-Control', 'public, max-age=30');
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

export default router;

