#!/usr/bin/env node
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

const tsConfig = buildTimescaleConfigFromEnv(process.env);

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

const pool = new pg.Pool({
  host: tsConfig.host,
  port: tsConfig.port,
  database: tsConfig.database,
  user: tsConfig.user,
  password: tsConfig.password || undefined,
  ssl: tsConfig.ssl ? { rejectUnauthorized: false } : undefined
});

const runMigration = async (file) => {
  const filepath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filepath, 'utf8');
  if (!sql.trim()) {
    console.warn(`[apply-migrations] Skipping empty migration ${file}`);
    return;
  }
  console.log(`[apply-migrations] Running ${file}`);
  try {
    // For materialized views, we need to use a direct client connection
    // with autocommit enabled (no transaction)
    const client = new Client({
      host: tsConfig.host,
      port: tsConfig.port,
      database: tsConfig.database,
      user: tsConfig.user,
      password: tsConfig.password || undefined,
      ssl: tsConfig.ssl ? { rejectUnauthorized: false } : undefined
    });
    
    try {
      await client.connect();
      
      // For continuous aggregates migration, check if views exist first
      if (file.includes('continuous_aggregates') || file.includes('additional_aggregates')) {
        const viewNames = file.includes('additional_aggregates') 
          ? ['minute_bars_4h', 'minute_bars_1w', 'minute_bars_1mo', 'minute_bars_1y']
          : ['minute_bars_5m'];
        
        const checkResult = await client.query(`
          SELECT COUNT(*) as count FROM timescaledb_information.continuous_aggregates 
          WHERE view_name = ANY($1);
        `, [viewNames]);
        
        if (Number(checkResult.rows[0]?.count) >= viewNames.length) {
          console.log(`[apply-migrations] ⚠ ${file} - continuous aggregates already exist, skipping`);
          await client.end();
          return;
        }
      }
      
      // Materialized views with TimescaleDB continuous aggregates cannot run in transactions
      // Split SQL into individual statements and run them separately
      const splitSql = (input) => {
        const out = [];
        let buf = '';
        let inDollar = false;
        let dollarTag = null;
        for (let i = 0; i < input.length; i++) {
          const ch = input[i];
          if (ch === '$') {
            const match = input.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
            if (match) {
              const token = match[0];
              buf += token;
              i += token.length - 1;
              if (!inDollar) {
                inDollar = true;
                dollarTag = token;
              } else if (inDollar && token === dollarTag) {
                inDollar = false;
                dollarTag = null;
              }
              continue;
            }
          }
          if (ch === ';' && !inDollar) {
            out.push(buf);
            buf = '';
          } else {
            buf += ch;
          }
        }
        if (buf.trim()) out.push(buf);
        return out
          .map(stmt => stmt
            .split(/\r?\n/)
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .trim())
          .filter(stmt => stmt.length > 0);
      };

      const statements = splitSql(sql);
      
      for (const statement of statements) {
        if (statement.trim()) {
          const preview = statement.replace(/\s+/g, ' ').slice(0, 120);
          console.log(`[apply-migrations] -> executing: ${preview}${statement.length > 120 ? '…' : ''}`);
          await client.query(statement);
        }
      }
    } finally {
      await client.end();
    }
    console.log(`[apply-migrations] ✓ Successfully ran ${file}`);
  } catch (err) {
    // If it's a "relation already exists" error, that's okay - skip it
    if (err.code === '42P07' || err.message.includes('already exists')) {
      console.log(`[apply-migrations] ⚠ ${file} - objects already exist, skipping`);
      return;
    }
    // If it's a view column rename error, that's okay - skip it
    if (err.code === '42P16' || err.message.includes('cannot change name of view column')) {
      console.log(`[apply-migrations] ⚠ ${file} - view column conflict, skipping`);
      return;
    }
    // If it's the transaction block error and views might exist, try to continue
    if (err.code === '25001' && (file.includes('continuous_aggregates') || file.includes('additional_aggregates'))) {
      console.log(`[apply-migrations] ⚠ ${file} - continuous aggregates may already exist, checking...`);
      // Try to verify if views exist
      try {
        const checkClient = new Client({
          host: tsConfig.host,
          port: tsConfig.port,
          database: tsConfig.database,
          user: tsConfig.user,
          password: tsConfig.password || undefined,
          ssl: tsConfig.ssl ? { rejectUnauthorized: false } : undefined
        });
        await checkClient.connect();
        
        const viewNames = file.includes('additional_aggregates')
          ? ['minute_bars_4h', 'minute_bars_1w', 'minute_bars_1mo', 'minute_bars_1y']
          : ['minute_bars_5m', 'minute_bars_15m', 'minute_bars_1h', 'minute_bars_1d'];
        
        const checkResult = await checkClient.query(`
          SELECT view_name FROM timescaledb_information.continuous_aggregates 
          WHERE view_name = ANY($1);
        `, [viewNames]);
        await checkClient.end();
        
        if (checkResult.rows.length >= viewNames.length) {
          console.log(`[apply-migrations] ⚠ ${file} - continuous aggregates already exist, skipping`);
          return;
        }
      } catch (checkErr) {
        // Ignore check errors
      }
    }
    console.error(`[apply-migrations] ✗ Error in ${file}:`, err.message);
    console.error(`[apply-migrations] Full error:`, err);
    throw err;
  }
};

const run = async () => {
  try {
    // Test connection first
    console.log('[apply-migrations] Testing database connection...');
    console.log('[apply-migrations] Connecting to:', {
      host: tsConfig.host,
      port: tsConfig.port,
      database: tsConfig.database,
      user: tsConfig.user,
      ssl: tsConfig.ssl ? 'enabled' : 'disabled'
    });
    
    await pool.query('SELECT NOW()');
    console.log('[apply-migrations] ✓ Database connection successful');
    
    for (const file of migrationFiles) {
      await runMigration(file);
    }
    console.log('[apply-migrations] ✓ Completed all migrations.');
  } catch (err) {
    console.error('[apply-migrations] ✗ Migration process failed');
    console.error('[apply-migrations] Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      stack: err.stack
    });
    throw err;
  } finally {
    await pool.end();
  }
};

run().catch((err) => {
  console.error('[apply-migrations] Failed:', err.message);
  process.exit(1);
});

