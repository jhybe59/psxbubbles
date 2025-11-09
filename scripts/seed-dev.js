#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
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
  console.warn('[seed-dev] dotenv-safe warning:', err.message);
}

const connection = {
  host: process.env.TIMESCALE_HOST || 'localhost',
  port: Number(process.env.TIMESCALE_PORT || 5432),
  database: process.env.TIMESCALE_DB || 'cryptobubbles',
  user: process.env.TIMESCALE_USER || 'postgres',
  password: process.env.TIMESCALE_PASSWORD || 'postgres'
};

const samples = [
  { symbol: 'HUBC', name: 'The Hub Power Company', sector: 'Power' },
  { symbol: 'OGDC', name: 'Oil & Gas Development Company', sector: 'Oil & Gas' },
  { symbol: 'PSX', name: 'Pakistan Stock Exchange', sector: 'Financials' },
  { symbol: 'HBL', name: 'Habib Bank Limited', sector: 'Banking' },
  { symbol: 'LUCK', name: 'Lucky Cement', sector: 'Cement' },
  { symbol: 'ENGRO', name: 'Engro Corporation', sector: 'Conglomerate' },
  { symbol: 'MCB', name: 'MCB Bank Limited', sector: 'Banking' },
  { symbol: 'UBL', name: 'United Bank Limited', sector: 'Banking' },
  { symbol: 'FATIMA', name: 'Fatima Fertilizer', sector: 'Fertilizer' },
  { symbol: 'FFC', name: 'Fauji Fertilizer Company', sector: 'Fertilizer' },
  { symbol: 'SEARL', name: 'The Searle Company', sector: 'Pharmaceutical' },
  { symbol: 'SYS', name: 'Systems Limited', sector: 'Technology' },
  { symbol: 'PAEL', name: 'Pak Elektron Limited', sector: 'Engineering' },
  { symbol: 'NETSOL', name: 'Netsol Technologies', sector: 'Technology' },
  { symbol: 'TRG', name: 'TRG Pakistan Limited', sector: 'Technology' },
  { symbol: 'SNGP', name: 'Sui Northern Gas Pipelines', sector: 'Oil & Gas' },
  { symbol: 'PSO', name: 'Pakistan State Oil', sector: 'Oil & Gas' },
  { symbol: 'HASCOL', name: 'HASCOL Petroleum', sector: 'Oil & Gas' },
  { symbol: 'KOHC', name: 'Kohat Cement Company', sector: 'Cement' },
  { symbol: 'DGKC', name: 'DG Khan Cement', sector: 'Cement' },
  { symbol: 'MLCF', name: 'Maple Leaf Cement', sector: 'Cement' },
  { symbol: 'GATM', name: 'Gul Ahmed Textile', sector: 'Textile' },
  { symbol: 'ILP', name: 'Interloop Limited', sector: 'Textile' },
  { symbol: 'ASTL', name: 'Amreli Steels Limited', sector: 'Steel' },
  { symbol: 'INIL', name: 'International Industries', sector: 'Steel' },
  { symbol: 'HINOON', name: 'Hi-Tech Lubricants', sector: 'Energy' },
  { symbol: 'PPL', name: 'Pakistan Petroleum Limited', sector: 'Oil & Gas' },
  { symbol: 'SHEL', name: 'Shell Pakistan', sector: 'Oil & Gas' },
  { symbol: 'SILK', name: 'Silk Bank', sector: 'Banking' },
  { symbol: 'JPGL', name: 'Jubilee Life Insurance', sector: 'Insurance' },
  { symbol: 'EFERT', name: 'Engro Fertilizers', sector: 'Fertilizer' },
  { symbol: 'KEL', name: 'K-Electric Limited', sector: 'Power' },
  { symbol: 'PKGS', name: 'Packages Limited', sector: 'Packaging' },
  { symbol: 'SHEL', name: 'Shell Pakistan', sector: 'Oil & Gas' },
  { symbol: 'EPCL', name: 'Engro Polymer & Chemicals', sector: 'Chemicals' },
  { symbol: 'SITC', name: 'Sitara Chemical Industries', sector: 'Chemicals' },
  { symbol: 'ATRL', name: 'Attock Refinery', sector: 'Oil & Gas' },
  { symbol: 'APL', name: 'Attock Petroleum', sector: 'Oil & Gas' },
  { symbol: 'MARI', name: 'Mari Petroleum', sector: 'Oil & Gas' },
  { symbol: 'AVN', name: 'Avanceon Limited', sector: 'Technology' },
  { symbol: 'HUMNL', name: 'Hum Network', sector: 'Media' },
  { symbol: 'PIBTL', name: 'Pakistan International Bulk Terminal', sector: 'Logistics' },
  { symbol: 'PKGP', name: 'Pakistan Refinery', sector: 'Oil & Gas' },
  { symbol: 'SYS', name: 'Systems Limited', sector: 'Technology' },
  { symbol: 'ANL', name: 'Azgard Nine', sector: 'Textile' },
  { symbol: 'NCL', name: 'Nishat Chunian', sector: 'Textile' },
  { symbol: 'BLKC', name: 'Bank Al Habib', sector: 'Banking' },
  { symbol: 'SOOP', name: 'Service Global Footwear', sector: 'Consumer' },
  { symbol: 'KTML', name: 'Khyber Textile Mills Limited', sector: 'Textile' },
  { symbol: 'NRL', name: 'National Refinery Limited', sector: 'Oil & Gas' },
  { symbol: 'GHNL', name: 'Ghazi Fabrics', sector: 'Textile' }
];

const indices = [
  { code: 'KSE100', name: 'KSE 100 Index' },
  { code: 'KSE30', name: 'KSE 30 Index' },
  { code: 'ALLSHR', name: 'All Share Index' }
];

const indexMembers = {
  KSE100: ['HUBC', 'OGDC', 'HBL', 'LUCK', 'ENGRO', 'MCB', 'UBL', 'SYS', 'TRG', 'PSO'],
  KSE30: ['HUBC', 'OGDC', 'HBL', 'LUCK', 'ENGRO', 'SYS'],
  ALLSHR: samples.map((row) => row.symbol)
};

const run = async () => {
  const client = new Client(connection);
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const row of samples) {
      await client.query(
        `INSERT INTO instruments (symbol, name, sector)
         VALUES ($1, $2, $3)
         ON CONFLICT (symbol) DO UPDATE SET
           name = EXCLUDED.name,
           sector = EXCLUDED.sector,
           updated_at = NOW()`,
        [row.symbol, row.name, row.sector]
      );
    }
    for (const idx of indices) {
      await client.query(
        `INSERT INTO indices (code, name)
         VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [idx.code, idx.name]
      );
    }

    for (const [code, members] of Object.entries(indexMembers)) {
      for (const symbol of members) {
        await client.query(
          `INSERT INTO index_members (index_code, symbol)
           VALUES ($1, $2)
           ON CONFLICT (index_code, symbol) DO NOTHING`,
          [code, symbol]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`[seed-dev] Upserted ${samples.length} instruments and ${indices.length} indices.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-dev] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run().catch((err) => {
  console.error('[seed-dev] Unexpected error:', err.message);
  process.exit(1);
});

