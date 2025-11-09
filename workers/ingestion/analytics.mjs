import { withClient } from './timescale.mjs';
import { setJSON, setString } from './cache.mjs';
import logger from './logger.mjs';

const MARKET_STATS_KEY = (interval, index = 'ALL') => `psx:market:stats:${interval}:${index}`;
const SECTOR_KEY = (interval) => `psx:market:sectors:${interval}`;
const INDICES_KEY = (interval) => `psx:market:indices:${interval}`;

const mapNumeric = (value) => (value == null ? null : Number(value));

const buildSymbolSnapshot = (row) => ({
  symbol: row.symbol,
  price: mapNumeric(row.close ?? row.price),
  intervalPct: mapNumeric(row.pct_change),
  dailyPct: mapNumeric(row.daily_pct),
  volume: mapNumeric(row.volume_sum ?? row.volume),
  turnover: mapNumeric(row.turnover_sum ?? row.turnover),
  ts: row.bucket ?? row.ts
});

const fetchMarketSnapshot = async (intervalTable, bucketQuery) => {
  const { bucket, index_code: indexCode } = bucketQuery;
  const statsQuery = `
    SELECT
      SUM(CASE WHEN pct_change > 0 THEN 1 ELSE 0 END) AS advancers,
      SUM(CASE WHEN pct_change < 0 THEN 1 ELSE 0 END) AS decliners,
      SUM(CASE WHEN pct_change = 0 THEN 1 ELSE 0 END) AS unchanged,
      SUM(volume_sum) AS volume_total,
      SUM(turnover_sum) AS turnover_total
    FROM ${intervalTable}
    WHERE bucket = $1 ${indexCode ? 'AND symbol IN (SELECT symbol FROM index_members WHERE index_code = $2)' : ''}
  `;

  const params = [bucket];
  if (indexCode) params.push(indexCode);

  const totals = await withClient(async (client) => {
    const result = await client.query(statsQuery, params);
    return result.rows[0];
  });

  return {
    interval: intervalTable.includes('1d') ? 'Day' : '5m',
    asOf: bucket,
    advancers: Number(totals?.advancers ?? 0),
    decliners: Number(totals?.decliners ?? 0),
    unchanged: Number(totals?.unchanged ?? 0),
    volumeTotal: mapNumeric(totals?.volume_total),
    turnoverTotal: mapNumeric(totals?.turnover_total)
  };
};

const fetchBucket = async (table, indexCode) => {
  const bucketResult = await withClient(async (client) => {
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

  return bucketResult;
};

const fetchSectorRows = async (viewName, bucket) => withClient(async (client) => {
  const sql = `
    SELECT sector, bucket, symbols, advancers, decliners, unchanged,
           pct_change, volume_sum, turnover_sum
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

const fetchTopMovers = async (table, bucket, direction = 'DESC', indexCode) => withClient(async (client) => {
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
  return result.rows.map(buildSymbolSnapshot);
});

const fetchIndices = async () => withClient(async (client) => {
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
  return result.rows.map((row) => ({
    code: row.code,
    name: row.name,
    members: Number(row.members || 0),
    latest: {
      asOf: row.bucket,
      level: 100 + Number(row.pct_change || 0), // placeholder baseline
      changePct: mapNumeric(row.pct_change),
      turnover: mapNumeric(row.turnover_sum),
      volume: mapNumeric(row.volume_sum)
    }
  }));
});

export const publishAnalyticsSnapshots = async () => {
  try {
    const indexCodes = await withClient(async (client) => {
      const result = await client.query('SELECT code FROM indices ORDER BY code ASC');
      return result.rows.map((row) => row.code);
    });

    const latest5m = await fetchBucket('minute_bars_5m', null);
    if (latest5m) {
      const market = await fetchMarketSnapshot('minute_bars_5m', { bucket: latest5m });
      const sectors = await fetchSectorRows('sector_performance_5m', latest5m);
      const gainers = await fetchTopMovers('minute_bars_5m', latest5m, 'DESC');
      const losers = await fetchTopMovers('minute_bars_5m', latest5m, 'ASC');
      market.topGainers = gainers;
      market.topLosers = losers;
      market.sectors = sectors;
      await setJSON(MARKET_STATS_KEY('5m'), market, 55);
      await setJSON(SECTOR_KEY('5m'), sectors, 55);
      await setString('psx:analytics:version', new Date(latest5m).toISOString(), 300);

      for (const code of indexCodes) {
        const bucket = await fetchBucket('minute_bars_5m', code);
        if (!bucket) continue;
        const idxStats = await fetchMarketSnapshot('minute_bars_5m', { bucket, index_code: code });
        idxStats.topGainers = await fetchTopMovers('minute_bars_5m', bucket, 'DESC', code);
        idxStats.topLosers = await fetchTopMovers('minute_bars_5m', bucket, 'ASC', code);
        await setJSON(MARKET_STATS_KEY('5m', code), idxStats, 55);
      }
    }

    const latest1d = await fetchBucket('minute_bars_1d', null);
    if (latest1d) {
      const marketDay = await fetchMarketSnapshot('minute_bars_1d', { bucket: latest1d });
      const sectorsDay = await fetchSectorRows('sector_performance_1d', latest1d);
      marketDay.sectors = sectorsDay;
      await setJSON(MARKET_STATS_KEY('Day'), marketDay, 300);
      await setJSON(SECTOR_KEY('Day'), sectorsDay, 300);

      for (const code of indexCodes) {
        const bucket = await fetchBucket('minute_bars_1d', code);
        if (!bucket) continue;
        const idxStats = await fetchMarketSnapshot('minute_bars_1d', { bucket, index_code: code });
        await setJSON(MARKET_STATS_KEY('Day', code), idxStats, 300);
      }
    }

    const indices = await fetchIndices();
    await setJSON(INDICES_KEY('5m'), { indices }, 55);
  } catch (err) {
    logger.error({ err }, 'Failed to publish analytics snapshots');
  }
};

export default {
  publishAnalyticsSnapshots
};


