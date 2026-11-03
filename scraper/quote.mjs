const asNumber = (value) => {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const asIsoTimestamp = (value) => {
  if (value == null || value === '') return null;

  let timestamp;
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
    timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return null;
    if (timestamp < 1e12) timestamp *= 1000;
  } else {
    timestamp = Date.parse(value);
  }

  if (!Number.isFinite(timestamp)) return null;
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
};

function fieldsFromRow(row) {
  if (Array.isArray(row)) {
    // Current PSX Terminal tuple: symbol, price, ..., volume, ..., status, timestamp, market.
    return {
      symbol: row[0],
      price: row[1],
      volume: row[4],
      marketStatus: row[12],
      timestamp: row[13],
      changePercent: row[3],
      high: row[6],
      low: row[7],
      market: row[14]
    };
  }

  if (row && typeof row === 'object') {
    return {
      symbol: row.symbol ?? row.s,
      price: row.price ?? row.lastPrice ?? row.c,
      volume: row.volume ?? row.cumulativeVolume ?? row.v,
      marketStatus: row.st ?? row.status,
      timestamp: row.timestamp ?? row.ts ?? row.t,
      changePercent: row.changePercent ?? row.pctChange ?? row.pch,
      high: row.high ?? row.h,
      low: row.low ?? row.l,
      market: row.market ?? row.m
    };
  }

  return null;
}

function rowsFromFrame(frame) {
  if (!frame || typeof frame !== 'object' || !('data' in frame)) return [];
  if (!Array.isArray(frame.data)) return [frame.data];
  if (frame.data.length === 0) return [];
  return Array.isArray(frame.data[0]) || (frame.data[0] && typeof frame.data[0] === 'object')
    ? frame.data
    : [frame.data];
}

export function normalizeQuoteFrame(frame, {
  expectedSymbol,
  receivedAt = new Date()
} = {}) {
  const rows = rowsFromFrame(frame);
  if (rows.length === 0) {
    return { events: [], skipped: [{ reason: 'missing_quote_rows' }], marketStatuses: [] };
  }

  const receivedAtIso = receivedAt instanceof Date
    ? receivedAt.toISOString()
    : new Date(receivedAt).toISOString();
  const events = [];
  const skipped = [];
  const marketStatuses = [];
  const details = [];

  for (const row of rows) {
    const fields = fieldsFromRow(row);
    if (!fields) {
      skipped.push({ reason: 'invalid_quote_row' });
      continue;
    }

    const symbol = String(fields.symbol ?? '').trim().toUpperCase();
    if (!symbol) {
      skipped.push({ reason: 'missing_symbol' });
      continue;
    }
    if (expectedSymbol && symbol !== expectedSymbol.toUpperCase()) {
      skipped.push({ reason: 'unexpected_symbol', symbol });
      continue;
    }

    const lastPrice = asNumber(fields.price);
    if (lastPrice == null) {
      skipped.push({ reason: 'missing_price', symbol });
      continue;
    }

    const marketStatus = fields.marketStatus == null
      ? null
      : String(fields.marketStatus).toUpperCase();
    if (marketStatus) marketStatuses.push({ symbol, status: marketStatus });

    events.push({
      symbol,
      sourceTimestamp: asIsoTimestamp(fields.timestamp),
      receivedAt: receivedAtIso,
      lastPrice,
      cumulativeVolume: asNumber(fields.volume)
    });
    const rawChangePercent = asNumber(fields.changePercent);
    details.push({
      symbol,
      changePercent: rawChangePercent == null
        ? null
        : (Math.abs(rawChangePercent) <= 1 ? rawChangePercent * 100 : rawChangePercent),
      dayHigh: asNumber(fields.high),
      dayLow: asNumber(fields.low),
      marketStatus,
      market: fields.market == null ? null : String(fields.market).toUpperCase()
    });
  }

  return { events, skipped, marketStatuses, details };
}

export class QuoteOrderGuard {
  #last = new Map();

  inspect(event) {
    const previous = this.#last.get(event.symbol);
    const sourceTime = event.sourceTimestamp == null
      ? null
      : Date.parse(event.sourceTimestamp);

    if (previous && sourceTime != null && previous.sourceTime != null) {
      if (sourceTime < previous.sourceTime) return 'out_of_order';
      if (
        sourceTime === previous.sourceTime
        && event.lastPrice === previous.lastPrice
        && event.cumulativeVolume === previous.cumulativeVolume
      ) return 'duplicate';
    } else if (
      previous
      && sourceTime == null
      && previous.sourceTime == null
      && event.lastPrice === previous.lastPrice
      && event.cumulativeVolume === previous.cumulativeVolume
    ) {
      return 'duplicate';
    }

    this.#last.set(event.symbol, {
      sourceTime: sourceTime ?? previous?.sourceTime ?? null,
      lastPrice: event.lastPrice,
      cumulativeVolume: event.cumulativeVolume
    });
    return null;
  }
}

export function sourceLagMs(event) {
  if (!event.sourceTimestamp) return null;
  const lag = Date.parse(event.receivedAt) - Date.parse(event.sourceTimestamp);
  return Number.isFinite(lag) ? lag : null;
}
