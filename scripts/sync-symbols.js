#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import axios from 'axios';
import dotenvSafe from 'dotenv-safe';

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

const connection = {
  host: process.env.TIMESCALE_HOST || 'localhost',
  port: Number(process.env.TIMESCALE_PORT || 5432),
  database: process.env.TIMESCALE_DB || 'cryptobubbles',
  user: process.env.TIMESCALE_USER || 'postgres',
  password: process.env.TIMESCALE_PASSWORD || 'postgres'
};

const apiBaseUrl = process.env.PSX_API_BASE_URL;
const apiToken = process.env.PSX_API_TOKEN;

if (!apiBaseUrl) {
  console.error('[sync-symbols] PSX_API_BASE_URL is required');
  process.exit(1);
}

const fetchSymbols = async () => {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL('symbols', normalizedBase);
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  const res = await axios.get(url.toString(), { headers, timeout: Number(process.env.PSX_API_TIMEOUT_MS || 10000) });
  if (!res.data) return [];

  const list = Array.isArray(res.data?.data) ? res.data.data : res.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((symbol) => (typeof symbol === 'string' ? symbol.trim().toUpperCase() : null))
    .filter(Boolean);
};

const upsertSymbols = async (symbols) => {
  if (!symbols.length) {
    console.log('[sync-symbols] No symbols fetched from PSX Terminal');
    return;
  }

  const client = new Client(connection);
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const symbol of symbols) {
      await client.query(
        `INSERT INTO instruments (symbol, name, active)
         VALUES ($1, $2, true)
         ON CONFLICT (symbol) DO UPDATE SET
           name = COALESCE(instruments.name, EXCLUDED.name),
           active = true,
           updated_at = NOW()`,
        [symbol, symbol]
      );
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


