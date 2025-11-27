import pino from 'pino';
import { config } from './config.mjs';

export const logger = pino({
  level: config.logLevel,
  // transport: config.env === 'development'
  //   ? { target: 'pino-pretty', options: { colorize: true, translateTime: true } }
  //   : undefined,
  base: { service: 'psx-ingestion-worker' }
});

export default logger;

