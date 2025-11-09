export const coerceNumber = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export const coerceTimestamp = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') {
    const isSeconds = value < 10 ** 12;
    return isSeconds ? value * 1000 : value;
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.valueOf();
  }
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const percentCandidates = (row) => [
  row.intervalPct,
  row.interval_pct,
  row.changePercent,
  row.change_percent,
  row.pct_change,
  row.percentageChange,
  row.pctChange,
  row.p,
  row[7]
];

const dailyPercentCandidates = (row) => [
  row.dailyPct,
  row.daily_pct,
  row.dailyChangePercent,
  row.dayChangePercent,
  row.day_change_percent,
  row['Price Change % 1 day'],
  row.dailyPercentage,
  row.dailyChange,
  row[8]
];

const turnoverCandidates = (row) => [
  row.turnover,
  row.value,
  row.tradedValue,
  row.tradeValue,
  row[6]
];

const timestampCandidates = (row) => [
  row.ts,
  row.timestamp,
  row.time,
  row.t,
  row.asOf,
  row.updatedAt,
  row[0]
];

export const normaliseRow = (row) => {
  if (!row) return null;
  const symbol = (row.symbol || row.ticker || '').toString().trim().toUpperCase();
  if (!symbol) return null;

  const ts = timestampCandidates(row)
    .map(coerceTimestamp)
    .find((val) => Number.isFinite(val));

  if (!Number.isFinite(ts)) return null;

  const percent = percentCandidates(row)
    .map(coerceNumber)
    .find((val) => val != null);

  const dailyPercent = dailyPercentCandidates(row)
    .map(coerceNumber)
    .find((val) => val != null);

  const turnover = turnoverCandidates(row)
    .map(coerceNumber)
    .find((val) => val != null);

  return {
    symbol,
    ts,
    open: coerceNumber(row.open ?? row.priceOpen ?? row.o ?? row.price ?? row[1]) ?? 0,
    high: coerceNumber(row.high ?? row.h ?? row.priceHigh ?? row.price ?? row[2]) ?? 0,
    low: coerceNumber(row.low ?? row.l ?? row.priceLow ?? row.price ?? row[3]) ?? 0,
    close: coerceNumber(row.close ?? row.c ?? row.priceClose ?? row.price ?? row[4]) ?? 0,
    volume: coerceNumber(row.volume ?? row.v ?? row.totalVolume ?? row.tradedVolume ?? row[5]) ?? 0,
    value: turnover ?? null,
    daily_pct: dailyPercent ?? null,
    intervalPct: percent ?? null,
    raw: row
  };
};

export default {
  coerceNumber,
  coerceTimestamp,
  normaliseRow
};


