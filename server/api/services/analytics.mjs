import { getCache, setCache, redisClient } from '../cache.mjs';
import { queryQuestDB } from '../questdb.mjs';
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

const intervalSettings = {
  '5m': { sampleBy: '5m', window: '24h' },
  Day: { sampleBy: '1d', window: '7d' }
};

const mapNumeric = (value) => (value == null ? null : Number(value));

/**
 * Get the latest bucket timestamp from QuestDB
 */
const fetchBucket = async (interval, indexCode) => {
  const settings = intervalSettings[interval];
  if (!settings) return null;

  try {
    // Get the last completed candle timestamp
    // We sample by interval, align to calendar
    const sql = `
      SELECT max(timestamp) as bucket
      FROM trades
      WHERE timestamp > dateadd('d', -1, now())
      SAMPLE BY ${settings.sampleBy} ALIGN TO CALENDAR
    `;
    const result = await queryQuestDB(sql);
    if (!result || !result.dataset || result.dataset.length === 0) return null;
    return result.dataset[0][0]; // timestamp string
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch analytics bucket');
    return null;
  }
};

/**
 * Build market totals (Advancers, Decliners, Unchanged, Volume, Turnover)
 * logic: Get Open/Close for all symbols for the target bucket, then aggregate.
 */
const buildTotals = async (interval, bucket, indexCode) => {
  const settings = intervalSettings[interval];

  // 1. Get stats for each symbol in this bucket
  // We calculate Open(first price), Close(last price), Volume(sum), Value(sum)
  // QuestDB's SAMPLE BY handles the time grouping
  // We filter by valid symbols implicitly

  // Note: QuestDB doesn't support complex CTEs with subsequent filtering easily in one go 
  // without subqueries.

  const indexFilter = indexCode ? `AND symbol IN (SELECT symbol FROM index_members WHERE index_code = '${indexCode}')` : '';

  const sql = `
    WITH ticker_stats AS (
        SELECT 
            symbol,
            first(price) as open,
            last(price) as close,
            sum(volume) as vol,
            sum(value) as val
        FROM trades
        WHERE timestamp = '${bucket}'
        ${indexFilter}
        SAMPLE BY ${settings.sampleBy} ALIGN TO CALENDAR
    )
    SELECT
        sum(case when close > open then 1 else 0 end) as advancers,
        sum(case when close < open then 1 else 0 end) as decliners,
        sum(case when close = open then 1 else 0 end) as unchanged,
        sum(vol) as volume_total,
        sum(val) as turnover_total
    FROM ticker_stats
  `;

  try {
    const result = await queryQuestDB(sql);
    if (!result || !result.dataset || result.dataset.length === 0) return null;

    // QuestDB returns array of arrays. Columns order depends on SELECT.
    // [advancers, decliners, unchanged, volume_total, turnover_total]
    const row = result.dataset[0];
    return {
      advancers: row[0],
      decliners: row[1],
      unchanged: row[2],
      volume_total: row[3],
      turnover_total: row[4]
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to build totals');
    return null;
  }
};

/**
 * Build Sector Performance via QuestDB
 * Note: QuestDB doesn't have sector info. We need to join with Postgres-sourced metadata?
 * Or we can fetch all symbol stats and aggregate in JS if needed.
 * But for now, let's assume we can't easily join QuestDB trades with Postgres sector info in one query.
 * 
 * Strategy: Fetch symbol stats from QuestDB, then group by sector in memory using cached sector map?
 * OR: existing 'sector_performance_X' views in Postgres are broken because minute_bars are gone.
 * 
 * Alternative: Since sector performance is visual/secondary, we can skip or deliver basic stats.
 * Better: Fetch ALL symbols performance from QuestDB, then group by sector here.
 * We need a way to know which symbol belongs to which sector.
 * `all_db_symbols.txt` or `symbols_from_db.json` might have it?
 * No, we should query Postgres for symbol->sector mapping once and cache it.
 */
import { withClient } from '../db.mjs'; // Keep for static metadata only

let sectorMapCache = null;
let sectorMapTime = 0;

const getSectorMap = async () => {
  if (sectorMapCache && (Date.now() - sectorMapTime < 3600000)) { // 1 hour cache
    return sectorMapCache;
  }

  try {
    const result = await withClient(async client => {
      // sectors table or symbols table has sector_name?
      // Let's assume 'sectors' table or 'symbols' joined with sectors
      return client.query('SELECT symbol, sector_name FROM symbols WHERE is_active = true');
    });

    const map = new Map();
    if (result && result.rows) {
      result.rows.forEach(r => map.set(r.symbol, r.sector_name));
    }
    sectorMapCache = map;
    sectorMapTime = Date.now();
    return map;
  } catch (err) {
    logger.warn('Failed to load sector map');
    return new Map();
  }
};

const buildSectors = async (interval, bucket) => {
  const settings = intervalSettings[interval];

  // Fetch stats for ALL symbols
  const sql = `
    SELECT 
        symbol,
        first(price) as open,
        last(price) as close,
        sum(volume) as vol,
        sum(value) as val
    FROM trades
    WHERE timestamp = '${bucket}'
    SAMPLE BY ${settings.sampleBy} ALIGN TO CALENDAR
  `;

  try {
    const [qResult, sectorMap] = await Promise.all([
      queryQuestDB(sql),
      getSectorMap()
    ]);

    if (!qResult || !qResult.dataset) return [];

    const sectors = new Map();
    // columns: symbol(0), open(1), close(2), vol(3), val(4)

    for (const row of qResult.dataset) {
      const sym = row[0];
      const open = row[1];
      const close = row[2];
      const vol = row[3];
      const val = row[4];

      const sectorName = sectorMap.get(sym) || 'Unknown';

      if (!sectors.has(sectorName)) {
        sectors.set(sectorName, {
          sector: sectorName,
          symbols: 0,
          advancers: 0,
          decliners: 0,
          unchanged: 0,
          volume: 0,
          turnover: 0,
          pctSum: 0 // to calc avg pct change
        });
      }

      const s = sectors.get(sectorName);
      s.symbols++;
      s.volume += (vol || 0);
      s.turnover += (val || 0);

      if (close > open) s.advancers++;
      else if (close < open) s.decliners++;
      else s.unchanged++;

      const pct = open > 0 ? ((close - open) / open) * 100 : 0;
      s.pctSum += pct;
    }

    return Array.from(sectors.values()).map(s => ({
      ...s,
      pctChange: s.symbols > 0 ? s.pctSum / s.symbols : 0,
      pctSum: undefined
    })).sort((a, b) => b.pctChange - a.pctChange);

  } catch (err) {
    logger.warn({ err }, 'Failed to build sectors');
    return [];
  }
};

const buildTopMovers = async (interval, bucket, direction, indexCode) => {
  // QuestDB sort
  const settings = intervalSettings[interval];
  const sortDir = direction === 'DESC' ? 'DESC' : 'ASC';
  const indexFilter = indexCode ? `AND symbol IN (SELECT symbol FROM index_members WHERE index_code = '${indexCode}')` : '';

  // We need to calculate pct_change first
  const sql = `
    WITH stats AS (
        SELECT 
            symbol,
            first(price) as open,
            last(price) as close,
            sum(volume) as vol,
            sum(value) as val,
            timestamp
        FROM trades
        WHERE timestamp = '${bucket}'
        ${indexFilter}
        SAMPLE BY ${settings.sampleBy} ALIGN TO CALENDAR
    )
    SELECT 
        symbol,
        close,
        (close - open) / open * 100 as pct_change,
        0 as daily_pct, -- placeholder
        vol,
        val,
        timestamp
    FROM stats
    WHERE open > 0
    ORDER BY pct_change ${sortDir}
    LIMIT 10
  `;

  try {
    const result = await queryQuestDB(sql);
    if (!result || !result.dataset) return [];

    // symbol(0), close(1), pct(2), daily(3), vol(4), val(5), ts(6)
    return result.dataset.map(row => ({
      symbol: row[0],
      price: mapNumeric(row[1]),
      intervalPct: mapNumeric(row[2]),
      dailyPct: mapNumeric(row[3]),
      volume: mapNumeric(row[4]),
      turnover: mapNumeric(row[5]),
      ts: row[6]
    }));
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch top movers');
    return [];
  }
};

const buildIndicesFallback = async () => withClient(async (client) => {
  // Keeping fallback logic for indices if indices tables are still valid in Postgres
  // Assuming 'indices' and 'index_members' tables still exist in Postgres (metadata)
  try {
    // Just return static indices for now to avoid complexity, 
    // as index_performance_latest view relied on minute_bars too probably.
    const staticResult = await client.query(`
      SELECT i.code, i.name, COUNT(im.symbol) as member_count
      FROM indices i
      LEFT JOIN index_members im ON i.code = im.index_code
      GROUP BY i.code, i.name
      ORDER BY i.code
    `);
    return {
      indices: staticResult.rows.map((row) => ({
        code: row.code,
        name: row.name,
        members: Number(row.member_count || 0),
        latest: {
          asOf: new Date().toISOString(),
          level: 100, // Dummy
          changePct: 0,
          turnover: 0,
          volume: 0
        }
      })),
      _warning: 'Index performance temporarily unavailable'
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch indices');
    return { indices: [] };
  }
});

export const getAnalyticsVersion = async () => 'v2-questdb';

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

  const timer = marketStatsDuration.startTimer({ interval, index: indexCode ?? 'ALL' });

  if (interval !== '5m' && interval !== 'Day') {
    // Only support 5m and Day for now in this refactor
    return null;
  }

  const bucket = await fetchBucket(interval, indexCode);
  if (!bucket) {
    timer();
    return {
      interval,
      index: indexCode,
      asOf: new Date().toISOString(),
      advancers: 0, decliners: 0, unchanged: 0, volumeTotal: 0, turnoverTotal: 0,
      sectors: [], topGainers: [], topLosers: [],
      _warning: 'No data available'
    };
  }

  const [totals, sectors, topGainers, topLosers] = await Promise.all([
    buildTotals(interval, bucket, indexCode),
    buildSectors(interval, bucket),
    interval === '5m' ? buildTopMovers(interval, bucket, 'DESC', indexCode) : [],
    interval === '5m' ? buildTopMovers(interval, bucket, 'ASC', indexCode) : []
  ]);

  const market = {
    interval,
    index: indexCode ?? null,
    asOf: bucket,
    advancers: Number(totals?.advancers ?? 0),
    decliners: Number(totals?.decliners ?? 0),
    unchanged: Number(totals?.unchanged ?? 0),
    volumeTotal: mapNumeric(totals?.volume_total),
    turnoverTotal: mapNumeric(totals?.turnover_total),
    sectors,
    topGainers,
    topLosers
  };

  await setCache(cacheKey, market, TTL[interval]);
  if (!indexCode && sectors?.length) {
    await setCache(SECTOR_KEY(interval), sectors, TTL[interval]);
  }

  timer();
  marketStatsRequests.labels(cacheHit ? 'hit' : 'miss', interval, indexCode ?? 'ALL').inc();

  return market;
};

export const getIndicesSnapshot = async () => {
  // Return fallback for now
  return await buildIndicesFallback();
};


