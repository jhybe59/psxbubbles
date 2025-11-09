import IORedis from 'ioredis';
import { config } from './config.mjs';

export const redisClient = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null
});

export const getCache = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

export const setCache = async (key, value, ttlSeconds) => {
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    await redisClient.set(key, payload, 'EX', ttlSeconds);
  } else {
    await redisClient.set(key, payload);
  }
};

export const quit = () => redisClient.quit();

export default {
  getCache,
  setCache,
  quit,
  redisClient
};

