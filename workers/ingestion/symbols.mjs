import { withClient } from './timescale.mjs';
import { fetchSymbols as fetchRemoteSymbols } from './psx-api.mjs';
import logger from './logger.mjs';

let cache = { symbols: [], lastLoaded: 0 };

const ONE_HOUR = 60 * 60 * 1000;

export const loadSymbols = async (force = false) => {
  const now = Date.now();
  if (!force && cache.symbols.length && now - cache.lastLoaded < ONE_HOUR) {
    return cache.symbols;
  }

  const rows = await withClient(async (client) => {
    const res = await client.query('SELECT symbol FROM instruments WHERE active = true ORDER BY symbol ASC');
    return res.rows;
  });

  let symbols = rows.map((row) => row.symbol);

  if (!symbols.length) {
    try {
      const remote = await fetchRemoteSymbols();
      if (remote.length) {
        await withClient(async (client) => {
          await client.query('BEGIN');
          try {
            for (const symbol of remote) {
              await client.query(
                `INSERT INTO instruments (symbol, name)
                 VALUES ($1, $2)
                 ON CONFLICT (symbol) DO NOTHING`,
                [symbol, symbol]
              );
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          }
        });
        symbols = remote;
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to hydrate instruments table from PSX Terminal symbols endpoint');
    }
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

