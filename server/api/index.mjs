import { config } from './config.mjs';
import logger from './logger.mjs';
import { closePool } from './db.mjs';
import cache from './cache.mjs';
import buildApp from './app.mjs';

const app = buildApp();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'API service listening');
});

const shutdown = async () => {
  logger.info('Shutting down API service');
  server.close();
  await closePool();
  try {
    await cache.quit();
  } catch (err) {
    logger.warn({ err }, 'Failed to quit Redis client');
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;

