import IORedis from 'ioredis';
import { config } from './config.mjs';
import logger from './logger.mjs';

const client = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null
});

export const setJSON = async (key, payload, ttlSeconds = 60) => {
  try {
    const value = JSON.stringify(payload);
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  } catch (err) {
    logger.warn({ err, key }, 'Failed to set Redis cache');
  }
};

export const setString = async (key, value, ttlSeconds = 60) => {
  try {
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  } catch (err) {
    logger.warn({ err, key }, 'Failed to set Redis string');
  }
};

export const getJSON = async (key) => {
  const value = await client.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getString = async (key) => client.get(key);

export const quit = async () => {
  try {
    await client.quit();
  } catch (err) {
    logger.warn({ err }, 'Failed to quit analytics Redis client');
  }
};

export default {
  setJSON,
  setString,
  getJSON,
  getString,
  quit
};


