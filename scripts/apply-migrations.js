#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
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
  console.warn('[apply-migrations] dotenv-safe warning:', err.message);
}

const required = ['TIMESCALE_HOST', 'TIMESCALE_PORT', 'TIMESCALE_DB', 'TIMESCALE_USER'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[apply-migrations] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const migrationsDir = path.join(projectRoot, 'db', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error('[apply-migrations] migrations directory not found:', migrationsDir);
  process.exit(1);
}

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (!migrationFiles.length) {
  console.log('[apply-migrations] No migration files found.');
  process.exit(0);
}

const sslEnabled = (() => {
  const value = process.env.TIMESCALE_SSL;
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
})();

const pool = new pg.Pool({
  host: process.env.TIMESCALE_HOST,
  port: Number(process.env.TIMESCALE_PORT),
  database: process.env.TIMESCALE_DB,
  user: process.env.TIMESCALE_USER,
  password: process.env.TIMESCALE_PASSWORD || undefined,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
});

const runMigration = async (file) => {
  const filepath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filepath, 'utf8');
  if (!sql.trim()) {
    console.warn(`[apply-migrations] Skipping empty migration ${file}`);
    return;
  }
  console.log(`[apply-migrations] Running ${file}`);
  await pool.query(sql);
};

const run = async () => {
  try {
    for (const file of migrationFiles) {
      await runMigration(file);
    }
    console.log('[apply-migrations] Completed all migrations.');
  } finally {
    await pool.end();
  }
};

run().catch((err) => {
  console.error('[apply-migrations] Failed:', err.message);
  process.exit(1);
});

