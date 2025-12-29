import { config } from './config.mjs';
import logger from './logger.mjs';
import { closePool } from './db.mjs';
import cache from './cache.mjs';
import buildApp from './app.mjs';
import { initSocketServer } from './socket-server.mjs';

const app = buildApp();
const server = app.listen(config.port, async () => {
  logger.info({ port: config.port }, 'API service listening');

  // Initialize Socket.IO for real-time breakout alerts
  try {
    await initSocketServer(server);
    logger.info('Socket.IO server attached');
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Socket.IO (non-fatal)');
  }
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
