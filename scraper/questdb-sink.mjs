import { Sender } from '@questdb/nodejs-client';
import { createClient } from 'redis';

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS psx_quotes (
  symbol SYMBOL,
  last_price DOUBLE,
  cumulative_volume DOUBLE,
  change_percent DOUBLE,
  day_high DOUBLE,
  day_low DOUBLE,
  market_status SYMBOL,
  market SYMBOL,
  source_timestamp STRING,
  received_at TIMESTAMP
) TIMESTAMP(received_at) PARTITION BY DAY WAL`;

const CANDLE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS psx_1m_bars (
  symbol SYMBOL,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  volume DOUBLE,
  first_source_timestamp STRING,
  last_source_timestamp STRING,
  received_at TIMESTAMP
) TIMESTAMP(received_at) PARTITION BY DAY WAL`;

const finite = (value) => Number.isFinite(value) ? value : null;

export function createQuestDbQuoteSink({
  env = process.env,
  log = (level, event, details = {}) => process.stderr.write(`${JSON.stringify({ level, event, ...details })}\n`),
  fetchImpl = globalThis.fetch,
  senderFactory = (config) => Sender.fromConfig(config),
  redisFactory = (options) => createClient(options)
} = {}) {
  const host = env.QUESTDB_HOST || 'localhost';
  const httpPort = Number(env.QUESTDB_HTTP_PORT) || 9000;
  const redisUrl = env.REDIS_URL || '';
  const url = `http://${host}:${httpPort}`;
  const states = new Map();
  let sender;
  let candleSender;
  let publisher;
  let queue = Promise.resolve();

  const ready = (async () => {
    const response = await fetchImpl(`${url}/exec?query=${encodeURIComponent(TABLE_SQL)}`);
    if (!response.ok) throw new Error(`QuestDB table setup returned HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(`QuestDB table setup failed: ${result.error}`);

    const candleResponse = await fetchImpl(`${url}/exec?query=${encodeURIComponent(CANDLE_TABLE_SQL)}`);
    if (!candleResponse.ok) throw new Error(`QuestDB candle table setup returned HTTP ${candleResponse.status}`);
    const candleResult = await candleResponse.json();
    if (candleResult.error) throw new Error(`QuestDB candle table setup failed: ${candleResult.error}`);
    const dedupResponse = await fetchImpl(`${url}/exec?query=${encodeURIComponent('ALTER TABLE psx_1m_bars DEDUP ENABLE UPSERT KEYS(received_at, symbol)')}`);
    if (!dedupResponse.ok) throw new Error(`QuestDB candle dedup setup returned HTTP ${dedupResponse.status}`);
    const dedupResult = await dedupResponse.json();
    if (dedupResult.error) throw new Error(`QuestDB candle dedup setup failed: ${dedupResult.error}`);

    sender = await senderFactory(`http::addr=${host}:${httpPort};request_timeout=10000;retry_timeout=5000;`);
    candleSender = await senderFactory(`http::addr=${host}:${httpPort};request_timeout=10000;retry_timeout=5000;`);
    if (redisUrl) {
      publisher = redisFactory({
        url: redisUrl,
        socket: { reconnectStrategy: (retries) => Math.min(retries * 500, 5000) }
      });
      publisher.on('error', (error) => log('warn', 'redis_publisher_error', { reason: error.message }));
      await publisher.connect();
    }
    log('info', 'quote_sinks_ready', { questdb: `${host}:${httpPort}`, redis: Boolean(publisher) });
  })();

  async function writeQuote({ event, details }) {
    await ready;

    const row = sender
      .table('psx_quotes')
      .symbol('symbol', event.symbol)
      .symbol('market_status', details?.marketStatus || 'UNK')
      .symbol('market', details?.market || env.PSXT_MARKET || 'REG')
      .floatColumn('last_price', event.lastPrice)
      .stringColumn('source_timestamp', event.sourceTimestamp || '');

    if (event.cumulativeVolume != null) row.floatColumn('cumulative_volume', event.cumulativeVolume);
    if (finite(details?.changePercent) != null) row.floatColumn('change_percent', details.changePercent);
    if (finite(details?.dayHigh) != null) row.floatColumn('day_high', details.dayHigh);
    if (finite(details?.dayLow) != null) row.floatColumn('day_low', details.dayLow);
    row.at(Date.parse(event.receivedAt), 'ms');
    await sender.flush();

    const sourceMs = Date.parse(event.sourceTimestamp || event.receivedAt);
    const receivedMs = Date.parse(event.receivedAt);
    const minuteMs = Math.floor(sourceMs / 60_000) * 60_000;
    const previousCandle = states.get(event.symbol);
    const currentMinute = previousCandle?.candle;
    const cumulativeVolume = finite(event.cumulativeVolume);
    const previousCumulativeVolume = previousCandle?.cumulativeVolume;
    const volumeDelta = cumulativeVolume == null || previousCumulativeVolume == null
      ? 0
      : Math.max(0, cumulativeVolume - previousCumulativeVolume);

    if (currentMinute && currentMinute.minuteMs !== minuteMs) {
      await writeCandle(event.symbol, currentMinute);
    }

    const activeCandle = currentMinute?.minuteMs === minuteMs ? currentMinute : {
      minuteMs,
      open: event.lastPrice,
      high: event.lastPrice,
      low: event.lastPrice,
      close: event.lastPrice,
      volume: 0,
      firstSourceTimestamp: event.sourceTimestamp || event.receivedAt,
      lastSourceTimestamp: event.sourceTimestamp || event.receivedAt,
      receivedAtMs: receivedMs
    };
    activeCandle.high = Math.max(activeCandle.high, event.lastPrice);
    activeCandle.low = Math.min(activeCandle.low, event.lastPrice);
    activeCandle.close = event.lastPrice;
    activeCandle.volume += volumeDelta;
    activeCandle.lastSourceTimestamp = event.sourceTimestamp || event.receivedAt;
    activeCandle.receivedAtMs = receivedMs;

    const previous = previousCandle;
    const high = Math.max(previous?.high ?? event.lastPrice, details?.dayHigh ?? event.lastPrice, event.lastPrice);
    const low = Math.min(previous?.low ?? event.lastPrice, details?.dayLow ?? event.lastPrice, event.lastPrice);
    const state = {
      open: previous?.open ?? event.lastPrice,
      high,
      low,
      volume: event.cumulativeVolume ?? previous?.volume ?? 0
    };
    state.candle = activeCandle;
    state.cumulativeVolume = cumulativeVolume ?? previousCumulativeVolume;
    states.set(event.symbol, state);

    if (publisher?.isReady) {
      const pct = finite(details?.changePercent) ?? 0;
      await publisher.publish('market-data', JSON.stringify({
        symbol: event.symbol,
        sourceTimestamp: event.sourceTimestamp,
        receivedAt: event.receivedAt,
        ts: event.sourceTimestamp || event.receivedAt,
        marketStatus: details?.marketStatus ?? null,
        intervals: {
          Day: {
            open: state.open,
            high: state.high,
            low: state.low,
            close: event.lastPrice,
            volume: state.volume,
            pct
          }
        }
      }));
    }
  }

  async function writeCandle(symbol, candle) {
    const row = candleSender
      .table('psx_1m_bars')
      .symbol('symbol', symbol)
      .floatColumn('open', candle.open)
      .floatColumn('high', candle.high)
      .floatColumn('low', candle.low)
      .floatColumn('close', candle.close)
      .floatColumn('volume', candle.volume)
      .stringColumn('first_source_timestamp', candle.firstSourceTimestamp)
      .stringColumn('last_source_timestamp', candle.lastSourceTimestamp);
    row.at(candle.minuteMs, 'ms');
    await candleSender.flush();
    log('info', 'minute_candle_written', {
      symbol,
      timestamp: new Date(candle.minuteMs).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    });
  }

  return {
    onQuote(quote) {
      queue = queue
        .then(() => writeQuote(quote))
        .catch((error) => log('error', 'quote_sink_failed', {
          symbol: quote?.event?.symbol,
          reason: error.message
        }));
      return queue;
    },
    async close() {
      await queue;
      await ready.catch(() => {});
      if (sender) {
        await sender.close().catch(() => {});
      }
      if (candleSender) await candleSender.close().catch(() => {});
      if (publisher?.isOpen) {
        await publisher.quit().catch(() => {});
      }
    }
  };
}
