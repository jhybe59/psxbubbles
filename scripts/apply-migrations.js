#!/usr/bin/env node
/**
 * PostgreSQL Migration Script
 * Applies SQL migrations from db/migrations directory to PostgreSQL
 * (No TimescaleDB dependencies - time-series data now in QuestDB)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Client } = pg;
import { buildTimescaleConfigFromEnv } from '../server/shared/db-config.mjs';
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

const dbConfig = buildTimescaleConfigFromEnv(process.env);

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

const runMigration = async (file) => {
  const filepath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filepath, 'utf8');

  // Remove comment-only lines
  const lines = sql.split('\n').filter(line => !line.trim().startsWith('--'));
  const cleanedSql = lines.join('\n').trim();

  if (!cleanedSql) {
    console.log(`[apply-migrations] ⚠ Skipping ${file} (empty/comment-only)`);
    return;
  }

  console.log(`[apply-migrations] Running ${file}`);

  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password || undefined,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();

    // Run entire SQL file as one statement (PostgreSQL handles multi-statement)
    const preview = cleanedSql.replace(/\s+/g, ' ').slice(0, 100);
    console.log(`[apply-migrations] -> ${preview}${cleanedSql.length > 100 ? '…' : ''}`);

    try {
      await client.query(cleanedSql);
    } catch (err) {
      // Ignore "already exists" errors
      if (err.code === '42P07' || err.message.includes('already exists')) {
        console.log(`[apply-migrations]    ⚠ Object already exists, continuing`);
        return;
      }
      // Ignore "does not exist" for DROP statements
      if (err.code === '42P01') {
        console.log(`[apply-migrations]    ⚠ Object doesn't exist, continuing`);
        return;
      }
      throw err;
    }

    console.log(`[apply-migrations] ✓ ${file}`);
  } finally {
    await client.end();
  }
};

const run = async () => {
  try {
    console.log('[apply-migrations] Testing database connection...');
    console.log('[apply-migrations] Connecting to:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      ssl: dbConfig.ssl ? 'enabled' : 'disabled'
    });

    const testClient = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password || undefined,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined
    });
    await testClient.connect();
    await testClient.query('SELECT NOW()');
    await testClient.end();
    console.log('[apply-migrations] ✓ Database connection successful');

    for (const file of migrationFiles) {
      await runMigration(file);
    }
    console.log('[apply-migrations] ✓ Completed all migrations.');
  } catch (err) {
    console.error('[apply-migrations] ✗ Migration failed:', err.message);
    throw err;
  }
};

run().catch((err) => {
  console.error('[apply-migrations] Failed:', err.message);
  process.exit(1);
});
