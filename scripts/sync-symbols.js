#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import axios from 'axios';
import dotenvSafe from 'dotenv-safe';

import { buildTimescaleConfigFromEnv } from '../server/shared/db-config.mjs';
import { config as workerConfig } from '../workers/ingestion/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
const examplePath = path.join(projectRoot, 'config', 'env.example');

try {
  dotenvSafe.config({
    allowEmptyValues: true,
    example: examplePath,
    path: fs.existsSync(envPath) ? envPath : undefined,
    silent: true
  });
} catch (err) {
  console.warn('[sync-symbols] dotenv-safe warning:', err.message);
}

const dbConfig = buildTimescaleConfigFromEnv(process.env);
const connection = {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined
};

const apiBaseUrl = process.env.PSX_API_BASE_URL;
const apiToken = process.env.PSX_API_TOKEN;

const fetchSymbols = async () => {
  // 1. Try fetching from config first (Robust & matches WebSocket logic)
  if (workerConfig.psxApi.symbolsList && workerConfig.psxApi.symbolsList.length > 0) {
    console.log(`[sync-symbols] Using ${workerConfig.psxApi.symbolsList.length} symbols from static config`);
    return workerConfig.psxApi.symbolsList;
  }

  // 2. Fallback to API fetch if config is empty
  if (!apiBaseUrl) {
    console.warn('[sync-symbols] PSX_API_BASE_URL missing and no static list found');
    return [];
  }

  console.log('[sync-symbols] Fetching symbols from API...');
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL('symbols', normalizedBase);
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  try {
    const res = await axios.get(url.toString(), { headers, timeout: Number(process.env.PSX_API_TIMEOUT_MS || 10000) });
    if (!res.data) return [];

    const list = Array.isArray(res.data?.data) ? res.data.data : res.data;
    if (!Array.isArray(list)) return [];
    return list
      .map((symbol) => (typeof symbol === 'string' ? symbol.trim().toUpperCase() : null))
      .filter(Boolean);
  } catch (err) {
    console.error('[sync-symbols] API fetch failed:', err.message);
    return [];
  }
};

const upsertSymbols = async (symbols) => {
  if (!symbols.length) {
    console.log('[sync-symbols] No symbols found to sync.');
    return;
  }

  const client = new Client(connection);
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const symbol of symbols) {
      await client.query(
        `INSERT INTO instruments (symbol, name, active)
         VALUES ($1, $1, true)
         ON CONFLICT (symbol) DO UPDATE SET
           active = true,
           updated_at = NOW()`,
        [symbol]
      ); // Using symbol as name for simplicity if name not available
    }
    await client.query('COMMIT');
    console.log(`[sync-symbols] Upserted ${symbols.length} symbols`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[sync-symbols] Failed to upsert symbols:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

const run = async () => {
  try {
    const symbols = await fetchSymbols();
    await upsertSymbols(symbols);
  } catch (err) {
    console.error('[sync-symbols] Unexpected error:', err.message);
    process.exit(1);
  }
};

run();


