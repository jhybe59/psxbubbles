import IORedis from 'ioredis';
import { config } from './config.mjs';

let memoryCache;
export const redisClient = config.redis.url
  ? new IORedis(config.redis.url, { maxRetriesPerRequest: null })
  : null;

export const getCache = async (key) => {
  if (redisClient) {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }
  if (!memoryCache) memoryCache = new Map();
  const entry = memoryCache.get(key);
  if (!entry) return null;
  const { expiresAt, payload } = entry;
  if (expiresAt && Date.now() > expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return payload;
};

export const setCache = async (key, value, ttlSeconds) => {
  if (redisClient) {
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.set(key, payload, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, payload);
    }
    return;
  }
  if (!memoryCache) memoryCache = new Map();
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  memoryCache.set(key, { payload: value, expiresAt });
};

export const quit = () => (redisClient ? redisClient.quit() : Promise.resolve());

export default {
  getCache,
  setCache,
  quit,
  redisClient
};

