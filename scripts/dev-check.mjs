#!/usr/bin/env node
// Diagnostic script: verify Timescale, Redis, API, Worker metrics.
import pg from 'pg';
import Redis from 'ioredis';
import process from 'node:process';

const env = process.env;
const cfg = {
  timescale: {
    host: env.TIMESCALE_HOST || 'localhost',
    port: Number(env.TIMESCALE_PORT) || 5432,
    database: env.TIMESCALE_DB || 'cryptobubbles',
    user: env.TIMESCALE_USER || 'postgres',
    password: env.TIMESCALE_PASSWORD || 'postgres'
  },
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  apiBase: env.VITE_LIVE_API_BASE_URL || 'http://localhost:8080/api',
  workerMetrics: `http://localhost:${env.METRICS_PORT || 9100}/metrics`
};

const timeout = (ms, label) => new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms));

const withTiming = async (label, fn) => {
  const start = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - start, result };
  } catch (err) {
    return { label, ok: false, ms: Date.now() - start, error: err.message };
  }
};

const checkTimescale = async () => {
  const pool = new pg.Pool(cfg.timescale);
  try {
    const res = await pool.query('SELECT NOW(), (SELECT count(*) FROM minute_bars) AS rows');
    return { now: res.rows[0].now, minuteBars: Number(res.rows[0].rows) };
  } finally {
    await pool.end();
  }
};

const checkRedis = async () => {
  const redis = new Redis(cfg.redisUrl, { lazyConnect: true });
  await redis.connect();
  const pong = await redis.ping();
  await redis.quit();
  return pong;
};

const checkApiHealth = async () => {
  const url = `${cfg.apiBase.replace(/\/$/, '')}/health`;
  const res = await fetch(url, { headers: { 'x-api-key': env.VITE_LIVE_API_KEY || env.API_KEY_PRIMARY || 'dev-api-key' } });
  const json = await res.json();
  return { statusCode: res.status, payload: json };
};

const checkWorkerMetrics = async () => {
  const res = await fetch(cfg.workerMetrics);
  const text = await res.text();
  // Extract a couple of key metrics if present
  const lagMatch = /ingestion_lag_seconds\{.*?} (\d+(?:\.\d+)?)/.exec(text);
  const rowsMatch = /ingestion_rows_last_batch\{.*?} (\d+(?:\.\d+)?)/.exec(text);
  return {
    metricsSize: text.length,
    ingestionLagSeconds: lagMatch ? Number(lagMatch[1]) : null,
    lastBatchRows: rowsMatch ? Number(rowsMatch[1]) : null
  };
};

const main = async () => {
  console.log('\n[dev-check] Running diagnostics...');
  const results = [];
  results.push(await withTiming('timescale', () => Promise.race([checkTimescale(), timeout(8000, 'timescale')])));
  results.push(await withTiming('redis', () => Promise.race([checkRedis(), timeout(4000, 'redis')])));
  results.push(await withTiming('api', () => Promise.race([checkApiHealth(), timeout(5000, 'api')])));
  results.push(await withTiming('worker-metrics', () => Promise.race([checkWorkerMetrics(), timeout(4000, 'worker-metrics')])));

  console.log('\n[dev-check] Summary');
  for (const r of results) {
    if (r.ok) {
      console.log(`  • ${r.label}: OK (${r.ms}ms)`);
    } else {
      console.log(`  • ${r.label}: FAIL (${r.ms}ms) - ${r.error}`);
    }
  }

  // Detail dump (only failures + key fields)
  for (const r of results) {
    if (!r.ok) continue;
    if (r.label === 'timescale') {
      console.log(`    timescale.minuteBars=${r.result.minuteBars}`);
    } else if (r.label === 'api') {
      console.log(`    api.statusCode=${r.result.statusCode} overall=${r.result.payload.status}`);
    } else if (r.label === 'worker-metrics') {
      console.log(`    worker.lag=${r.result.ingestionLagSeconds} rows=${r.result.lastBatchRows}`);
    }
  }

  const failures = results.filter(r => !r.ok).map(r => r.label);
  if (failures.length) {
    console.error(`\n[dev-check] Failures: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\n[dev-check] All checks passed');
  }
};

main().catch(err => {
  console.error('[dev-check] Unexpected error:', err);
  process.exit(1);
});
