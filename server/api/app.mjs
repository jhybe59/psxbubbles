import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { config } from './config.mjs';
import logger from './logger.mjs';
import { redisClient } from './cache.mjs';
import { metricsHandler } from './metrics.mjs';
import bubblesRoute from './routes/bubbles.mjs';
import snapshotsRoute from './routes/snapshots.mjs';
import indicesRoute from './routes/indices.mjs';
import healthRoute from './routes/health.mjs';
import marketStatsRoute from './routes/market-stats.mjs';

export const buildApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info({ http: message.trim() })
    }
  }));

  const limiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: config.rateLimit.points,
    duration: config.rateLimit.duration,
    keyPrefix: 'rlflx'
  });

  const apiKeyMiddleware = (req, res, next) => {
    const provided = req.headers['x-api-key'];
    if (!config.apiKeys.primary && !config.apiKeys.secondary) {
      next();
      return;
    }
    if ([config.apiKeys.primary, config.apiKeys.secondary].filter(Boolean).includes(provided)) {
      next();
      return;
    }
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
  };

  const rateLimitMiddleware = async (req, res, next) => {
    const key = req.headers['x-api-key'] || req.ip;
    try {
      await limiter.consume(key);
      next();
    } catch (err) {
      res.set('Retry-After', String(err.msBeforeNext / 1000));
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    }
  };

  app.use('/api', apiKeyMiddleware, rateLimitMiddleware);
  app.get('/metrics', metricsHandler);
  app.use('/api/bubbles', bubblesRoute);
  app.use('/api/snapshots', snapshotsRoute);
  app.use('/api/indices', indicesRoute);
  app.use('/api/market-stats', marketStatsRoute);
  app.use('/api/health', healthRoute);

  app.use((err, req, res, _next) => { // eslint-disable-line no-unused-vars
    logger.error({ err, path: req.path }, 'Unhandled API error');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  return app;
};

export default buildApp;

