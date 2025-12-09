import { config } from './config.mjs';
import logger from './logger.mjs';
import startMetricsServer from './metrics.mjs';
import wsManager from './websocket-manager.mjs';

const start = async () => {
  // startMetricsServer();

  logger.info('Starting WebSocket Ingestion Worker');
  await wsManager.start();

  const shutdown = async () => {
    logger.info('Shutting down ingestion worker');
    await wsManager.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch((err) => {
  logger.error({ err }, 'Failed to start ingestion worker');
  process.exit(1);
});


