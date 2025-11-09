import BullMQ from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config.mjs';
import logger from './logger.mjs';

const { Queue, Worker } = BullMQ;

const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null
});

export const queueNames = {
  fetch: 'psx-fetch-minute-bars'
};

export const fetchQueue = new Queue(queueNames.fetch, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: Math.max(1, config.worker.maxRetries || 3),
    backoff: {
      type: 'exponential',
      delay: Math.max(1000, (config.worker.retryBackoffSeconds || 30) * 1000)
    }
  }
});

export const buildWorker = (processor) => new Worker(queueNames.fetch, processor, {
  connection,
  concurrency: 4
});

export const disconnect = async () => {
  try {
    await fetchQueue.close();
  } catch (err) {
    logger.warn({ err }, 'Failed to close queue');
  }
  try {
    await connection.quit();
  } catch (err) {
    logger.warn({ err }, 'Failed to quit Redis connection');
  }
};

export default {
  fetchQueue,
  buildWorker,
  disconnect
};

