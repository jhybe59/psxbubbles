import { getCache, setCache, redisClient } from '../cache.mjs';
import { withClient } from '../db.mjs';
import logger from '../logger.mjs';
import {
  marketStatsRequests,
  marketStatsDuration,
  indicesRequests,
  indicesDuration
} from '../metrics.mjs';

const MARKET_KEY = (interval, index = 'ALL') => `psx:market:stats:${interval}:${index}`;
const SECTOR_KEY = (interval) => `psx:market:sectors:${interval}`;
const INDICES_KEY = (interval) => `psx:market:indices:${interval}`;
const TTL = {
  '5m': 55,
  Day: 300
};

const intervalSources = {
  '5m': {
    table: 'minute_bars_5m',
    sectorView: 'sector_performance_5m'
  },
  Day: {
    table: 'minute_bars_1d',
    sectorView: 'sector_performance_1d'
  }
};

const mapNumeric = (value) => (value == null ? null : Number(value));

const fetchBucket = async (table, indexCode) => withClient(async (client) => {
  const sql = indexCode
    ? `
        SELECT max(bucket) AS bucket
        FROM ${table}
        WHERE symbol IN (SELECT symbol FROM index_members WHERE index_code = $1)
      `
    : `
        SELECT max(bucket) AS bucket
        FROM ${table}
      `;
  const params = indexCode ? [indexCode] : [];
  const result = await client.query(sql, params);
  return result.rows[0]?.bucket || null;
});

const buildTotals = async (table, bucket, indexCode) => withClient(async (client) => {
  const sql = `
    SELECT
      SUM(CASE WHEN pct_change > 0 THEN 1 ELSE 0 END) AS advancers,
      SUM(CASE WHEN pct_change < 0 THEN 1 ELSE 0 END) AS decliners,
      SUM(CASE WHEN pct_change = 0 THEN 1 ELSE 0 END) AS unchanged,
      SUM(volume_sum) AS volume_total,
      SUM(turnover_sum) AS turnover_total
    FROM ${table}
    WHERE bucket = $1
      ${indexCode ? 'AND symbol IN (SELECT symbol FROM index_members WHERE index_code = $2)' : ''}
  `;
  const params = indexCode ? [bucket, indexCode] : [bucket];
  const result = await client.query(sql, params);
  return result.rows[0];
});

const buildSectors = async (viewName, bucket) => withClient(async (client) => {
  const sql = `
    SELECT sector, symbols, advancers, decliners, unchanged, pct_change, turnover_sum, volume_sum
    FROM ${viewName}
    WHERE bucket = $1
    ORDER BY pct_change DESC
  `;
  const result = await client.query(sql, [bucket]);
  return result.rows.map((row) => ({
    sector: row.sector,
    symbols: Number(row.symbols || 0),
    advancers: Number(row.advancers || 0),
    decliners: Number(row.decliners || 0),
    unchanged: Number(row.unchanged || 0),
    pctChange: mapNumeric(row.pct_change),
    turnover: mapNumeric(row.turnover_sum),
    volume: mapNumeric(row.volume_sum)
  }));
});

const buildTopMovers = async (table, bucket, direction, indexCode) => withClient(async (client) => {
  const sql = `
    SELECT symbol, close, pct_change, daily_pct, volume_sum, turnover_sum, bucket
    FROM ${table}
    WHERE bucket = $1
      ${indexCode ? 'AND symbol IN (SELECT symbol FROM index_members WHERE index_code = $2)' : ''}
    ORDER BY pct_change ${direction}
    LIMIT 10
  `;
  const params = indexCode ? [bucket, indexCode] : [bucket];
  const result = await client.query(sql, params);
  return result.rows.map((row) => ({
    symbol: row.symbol,
    price: mapNumeric(row.close),
    intervalPct: mapNumeric(row.pct_change),
    dailyPct: mapNumeric(row.daily_pct),
    volume: mapNumeric(row.volume_sum),
    turnover: mapNumeric(row.turnover_sum),
    ts: row.bucket
  }));
});

const buildIndicesFallback = async () => withClient(async (client) => {
  const sql = `
    SELECT idx.code,
           idx.name,
           perf.bucket,
           perf.members,
           perf.pct_change,
           perf.turnover_sum,
           perf.volume_sum
    FROM index_performance_latest perf
    JOIN indices idx ON idx.code = perf.index_code
    ORDER BY idx.code
  `;
  const result = await client.query(sql);
  return {
    indices: result.rows.map((row) => ({
      code: row.code,
      name: row.name,
      members: Number(row.members || 0),
      latest: {
        asOf: row.bucket,
        level: 100 + Number(row.pct_change || 0),
        changePct: mapNumeric(row.pct_change),
        turnover: mapNumeric(row.turnover_sum),
        volume: mapNumeric(row.volume_sum)
      }
    }))
  };
});

export const getAnalyticsVersion = async () => redisClient.get('psx:analytics:version');

export const getMarketStats = async (interval, indexCode) => {
  const cacheKey = MARKET_KEY(interval, indexCode ?? 'ALL');
  let cacheHit = false;
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      cacheHit = true;
      marketStatsRequests.labels('hit', interval, indexCode ?? 'ALL').inc();
      return cached;
    }
  } catch (err) {
    logger.warn({ err, cacheKey }, 'Failed to read market stats cache');
  }

  const source = intervalSources[interval];
  if (!source) throw new Error(`Unsupported interval ${interval}`);

  const timer = marketStatsDuration.startTimer({ interval, index: indexCode ?? 'ALL' });
  const bucket = await fetchBucket(source.table, indexCode);
  if (!bucket) {
    timer();
    marketStatsRequests.labels('miss', interval, indexCode ?? 'ALL').inc();
    return null;
  }

  const totals = await buildTotals(source.table, bucket, indexCode);
  const market = {
    interval,
    index: indexCode ?? null,
    asOf: bucket,
    advancers: Number(totals?.advancers ?? 0),
    decliners: Number(totals?.decliners ?? 0),
    unchanged: Number(totals?.unchanged ?? 0),
    volumeTotal: mapNumeric(totals?.volume_total),
    turnoverTotal: mapNumeric(totals?.turnover_total)
  };

  const sectors = await buildSectors(source.sectorView, bucket);
  market.sectors = sectors;

  if (interval === '5m') {
    market.topGainers = await buildTopMovers(source.table, bucket, 'DESC', indexCode);
    market.topLosers = await buildTopMovers(source.table, bucket, 'ASC', indexCode);
  }

  await setCache(cacheKey, market, TTL[interval]);
  if (!indexCode && sectors?.length) {
    await setCache(SECTOR_KEY(interval), sectors, TTL[interval]);
  }

  timer();
  marketStatsRequests.labels(cacheHit ? 'hit' : 'miss', interval, indexCode ?? 'ALL').inc();

  return market;
};

export const getIndicesSnapshot = async () => {
  const cacheKey = INDICES_KEY('5m');
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      indicesRequests.labels('hit').inc();
      return cached;
    }
  } catch (err) {
    logger.warn({ err, cacheKey }, 'Failed to read indices cache');
  }

  const endTimer = indicesDuration.startTimer();
  const fallback = await buildIndicesFallback();
  await setCache(cacheKey, fallback, TTL['5m']);
  endTimer();
  indicesRequests.labels('miss').inc();
  return fallback;
};



