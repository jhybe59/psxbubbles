import { withClient } from './timescale.mjs';
import { config } from './config.mjs';
import logger from './logger.mjs';

let cache = { symbols: [], lastLoaded: 0 };

const ONE_HOUR = 60 * 60 * 1000;

export const loadSymbols = async (force = false) => {
  // If specific symbols list is configured, use that
  if (config.psxApi.symbolsList && config.psxApi.symbolsList.length > 0) {
    logger.info({ count: config.psxApi.symbolsList.length }, 'Using configured symbols list');
    return config.psxApi.symbolsList;
  }

  const now = Date.now();
  if (!force && cache.symbols.length && now - cache.lastLoaded < ONE_HOUR) {
    return cache.symbols;
  }

  const rows = await withClient(async (client) => {
    const res = await client.query('SELECT symbol FROM instruments WHERE active = true ORDER BY symbol ASC');
    return res.rows;
  });

  let symbols = rows.map((row) => row.symbol);

  // If no symbols in DB, fallback to default list in config if available, or empty
  if (!symbols.length) {
    logger.warn('No symbols found in DB. Please ensure instruments table is populated or config.psxApi.symbolsList is set.');
  }

  cache = {
    symbols,
    lastLoaded: now
  };
  return cache.symbols;
};

export default {
  loadSymbols
};

