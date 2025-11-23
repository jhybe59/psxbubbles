#!/usr/bin/env node
import pg from 'pg';
import { buildTimescaleConfigFromEnv } from '../server/shared/db-config.mjs';
import dotenvSafe from 'dotenv-safe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  console.warn('[cleanup] dotenv-safe warning:', err.message);
}

const tsConfig = buildTimescaleConfigFromEnv(process.env);

const { Client } = pg;

const configuredSymbols = [
  'PIBTL', 'BECO', 'MLCF', 'LOTCHEM', 'KEL', 'TELE', 'PRL', 'CNERGY', 'GCIL', 'PAEL',
  'BNL', 'TREET', 'PIOC', 'TPLP', 'BFAGRO', 'TOMCL', 'FCCL', 'OBOY', 'WASL', 'EPCL',
  'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
  'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY', 'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL',
  'CRTM', 'GWLC', 'HUBC', 'MEBL', 'OGDC', 'EMCO', 'FATIMA', 'IMAGE', 'SYS', 'CPHL',
  'BGL', 'CTM', 'BIPL', 'AVN', 'JVDC', 'TRSM', 'MARI', 'NETSOL', 'YOUW', 'SYM',
  'BFMOD', 'GHGL', 'OCTOPUS', 'BBFL', 'GAL', 'BIFO', 'GHNI', 'SAZEW', 'FLYNG', 'ISL',
  'GGL', 'GGGL', 'GCIL', 'GCWL', 'IBLHL'
];

const client = new Client({
  host: tsConfig.host,
  port: tsConfig.port,
  database: tsConfig.database,
  user: tsConfig.user,
  password: tsConfig.password || undefined,
  ssl: tsConfig.ssl ? { rejectUnauthorized: false } : undefined
});

(async () => {
  try {
    console.log('[cleanup] Connecting to database...');
    await client.connect();
    console.log('[cleanup] ✓ Connected');
    
    console.log('[cleanup] Deleting old symbols data...');
    const result = await client.query(
      `DELETE FROM minute_bars WHERE symbol != ALL($1)`,
      [configuredSymbols]
    );
    
    console.log(`[cleanup] ✓ Deleted ${result.rowCount} rows for old symbols`);
    console.log('[cleanup] ✓ Cleanup complete!');
  } catch (err) {
    console.error('[cleanup] ✗ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();

