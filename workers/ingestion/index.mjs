import { config } from './config.mjs';
import logger from './logger.mjs';
import startMetricsServer from './metrics.mjs';
import wsManager from './websocket-manager.mjs';

import { clearTodayData } from '../../scripts/clear-today-data.mjs';

const start = async () => {
  // startMetricsServer();

  // Check if we should clear data (Auto-run at approx 9:00 AM PKT = 04:00 UTC)
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();

  // If startup happens between 03:55 and 04:15 UTC, we assume it's the scheduled job
  if (utcHour === 4 && utcMin <= 15) {
    logger.info('Startup detected during scheduled window (04:00 UTC). Clearing today\'s data...');
    try {
      await clearTodayData();
    } catch (err) {
      logger.error({ err }, 'Failed to clear data on startup, continuing anyway...');
    }
  }

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


