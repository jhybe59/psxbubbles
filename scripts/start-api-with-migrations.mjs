#!/usr/bin/env node
/**
 * Startup script for API service that runs migrations if needed
 * This checks if tables exist before running migrations to avoid unnecessary runs
 */

import { execSync } from 'node:child_process';
import { buildTimescaleConfigFromEnv } from '../server/shared/db-config.mjs';
import pg from 'pg';

const tsConfig = buildTimescaleConfigFromEnv(process.env);

// Check if migrations should run
const shouldRunMigrations = async () => {
  // If AUTO_MIGRATE is explicitly set to false, skip
  if (process.env.AUTO_MIGRATE === 'false') {
    console.log('[start-api] AUTO_MIGRATE=false, skipping migrations');
    return false;
  }

  // If AUTO_MIGRATE is explicitly set to true, always run
  if (process.env.AUTO_MIGRATE === 'true') {
    console.log('[start-api] AUTO_MIGRATE=true, will run migrations');
    return true;
  }

  // Default: Check if tables exist
  try {
    const pool = new pg.Pool({
      host: tsConfig.host,
      port: tsConfig.port,
      database: tsConfig.database,
      user: tsConfig.user,
      password: tsConfig.password || undefined,
      ssl: tsConfig.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000
    });

    // Check if instruments table exists (first migration creates it)
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'instruments'
      );
    `);

    await pool.end();

    const tablesExist = result.rows[0].exists;
    
    if (tablesExist) {
      console.log('[start-api] Database tables already exist, skipping migrations');
      return false;
    } else {
      console.log('[start-api] Database tables not found, will run migrations');
      return true;
    }
  } catch (err) {
    console.warn('[start-api] Could not check database, will attempt migrations:', err.message);
    // If we can't connect, try migrations anyway (might be first run)
    return true;
  }
};

const runMigrations = () => {
  console.log('[start-api] Running database migrations...');
  try {
    execSync('npm run db:migrate', { 
      stdio: 'inherit',
      env: process.env 
    });
    console.log('[start-api] Migrations completed successfully');
  } catch (err) {
    console.error('[start-api] Migration failed:', err.message);
    process.exit(1);
  }
};

const syncSymbols = () => {
  console.log('[start-api] Syncing symbols to database...');
  try {
    execSync('npm run sync:symbols', { 
      stdio: 'inherit',
      env: process.env 
    });
    console.log('[start-api] Symbols synced successfully');
  } catch (err) {
    // Don't exit on symbol sync failure - API can still work
    console.warn('[start-api] Symbol sync failed (non-fatal):', err.message);
  }
};

const startAPI = async () => {
  console.log('[start-api] Starting API service...');
  // Start the API service
  try {
    await import('../server/api/index.mjs');
  } catch (err) {
    console.error('[start-api] Failed to start API:', err);
    process.exit(1);
  }
};

// Main execution
(async () => {
  try {
    const needsMigrations = await shouldRunMigrations();
    
    if (needsMigrations) {
      runMigrations();
    }
    
    // Always try to sync symbols (ensures instruments table is populated)
    syncSymbols();
    
    await startAPI();
  } catch (err) {
    console.error('[start-api] Startup error:', err);
    process.exit(1);
  }
})();

