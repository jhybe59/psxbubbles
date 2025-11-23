import { Counter, Gauge, Histogram } from 'prom-client';
import { fetchQueue, buildWorker, disconnect } from './queue.mjs';
import { config } from './config.mjs';
import logger from './logger.mjs';
import { loadSymbols } from './symbols.mjs';
import { fetchMinuteBars } from './psx-api.mjs';
import { insertMinuteBars, closePool } from './timescale.mjs';
import startMetricsServer from './metrics.mjs';
import { normaliseRow } from './normalise.mjs';
import { publishAnalyticsSnapshots } from './analytics.mjs';
import { quit as quitCache } from './cache.mjs';

const JOB_NAME = 'poll-minute-bars';

const rowsGauge = new Gauge({
  name: 'ingestion_rows_last_batch',
  help: 'Number of rows processed in the last ingestion batch'
});

const ingestionLagGauge = new Gauge({
  name: 'ingestion_lag_seconds',
  help: 'Lag between latest ingested timestamp and now in seconds'
});

const fetchDuration = new Histogram({
  name: 'ingestion_fetch_duration_ms',
  help: 'Duration of external API fetch in milliseconds',
  buckets: [100, 250, 500, 1000, 2000, 4000, 8000]
});

const ingestDuration = new Histogram({
  name: 'ingestion_write_duration_ms',
  help: 'Duration of Timescale insert in milliseconds',
  buckets: [10, 50, 100, 250, 500, 1000, 2000]
});

const jobCounter = new Counter({
  name: 'ingestion_jobs_total',
  help: 'Ingestion jobs executed grouped by status',
  labelNames: ['status']
});

const chunkSymbols = (symbols, size) => {
  if (!Array.isArray(symbols) || !symbols.length) return [];
  const chunkSize = Math.max(1, size || symbols.length || 1);
  const chunks = [];
  for (let i = 0; i < symbols.length; i += chunkSize) {
    chunks.push(symbols.slice(i, i + chunkSize));
  }
  return chunks;
};

const getMinuteOfDay = (date = new Date()) => (date.getHours() * 60) + date.getMinutes();

const processJob = async (_job) => {
  const symbols = await loadSymbols();
  logger.info({ count: symbols.length }, 'Fetched symbol universe');

  const now = new Date();
  const minuteOfDay = getMinuteOfDay(now);
  const {
    symbolsPerMinute,
    marketOpenMinute,
    marketCloseMinute,
    symbolFetchDelayMinutes
  } = config.worker;

  const effectiveOpenMinute = Number.isFinite(marketOpenMinute) ? marketOpenMinute : 0;
  const effectiveCloseMinute = Number.isFinite(marketCloseMinute) && marketCloseMinute > effectiveOpenMinute
    ? marketCloseMinute
    : null;
  const startMinute = effectiveOpenMinute + Math.max(0, symbolFetchDelayMinutes || 0);

  if (minuteOfDay < startMinute) {
    logger.info({
      minuteOfDay,
      startMinute,
      reason: 'before_schedule_window'
    }, 'Skipping ingestion cohort');
    return;
  }

  if (effectiveCloseMinute != null && minuteOfDay > effectiveCloseMinute) {
    logger.info({
      minuteOfDay,
      effectiveCloseMinute,
      reason: 'after_market_close'
    }, 'Skipping ingestion cohort');
    return;
  }

  // If symbolsPerMinute is >= total symbols, process all symbols every minute
  const cohorts = chunkSymbols(symbols, symbolsPerMinute);
  if (!cohorts.length) {
    logger.warn('No symbol cohorts available for ingestion');
    return;
  }

  // If only one cohort (all symbols fit in one batch), always use it
  // Otherwise, rotate through cohorts based on time
  const minutesSinceStart = minuteOfDay - startMinute;
  const cohortIndex = cohorts.length === 1 ? 0 : (minutesSinceStart % cohorts.length);
  const cohortSymbols = cohorts[cohortIndex];

  if (!cohortSymbols || !cohortSymbols.length) {
    logger.warn({
      cohortIndex,
      cohorts: cohorts.length
    }, 'Selected ingestion cohort is empty, skipping');
    return;
  }

  logger.info({
    minuteOfDay,
    cohortIndex,
    cohorts: cohorts.length,
    cohortSize: cohortSymbols.length,
    totalSymbols: symbols.length
  }, 'Processing ingestion cohort');

  // Use ticks endpoint - no timestamp needed
  const fetchEnd = fetchDuration.startTimer();
  const payload = await fetchMinuteBars(cohortSymbols);
  fetchEnd();

  const normalised = payload
    .map(normaliseRow)
    .filter(Boolean)
    .sort((a, b) => {
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.symbol.localeCompare(b.symbol);
    });

  rowsGauge.set(normalised.length);

  if (!normalised.length) {
    logger.warn('No rows returned from PSX API');
    return;
  }

  const ingestEnd = ingestDuration.startTimer();
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < normalised.length; i += batchSize) {
    const slice = normalised.slice(i, i + batchSize);
    inserted += await insertMinuteBars(slice);
  }
  ingestEnd();

  await publishAnalyticsSnapshots();

  const latestTs = normalised.reduce((acc, row) => Math.max(acc, row.ts), 0);
  if (latestTs) {
    const lagSeconds = Math.max(0, (Date.now() - latestTs) / 1000);
    ingestionLagGauge.set(lagSeconds);
  }

  logger.info({
    inserted,
    rows: normalised.length,
    cohortIndex,
    cohorts: cohorts.length,
    cohortSize: cohortSymbols.length
  }, 'Ingested minute bars cohort');
};

const start = async () => {
  startMetricsServer();
  const repeatableJobs = await fetchQueue.getRepeatableJobs();
  const exists = repeatableJobs.find((job) => job.name === JOB_NAME);
  if (!exists) {
    await fetchQueue.add(JOB_NAME, {}, {
      repeat: { pattern: config.worker.cron },
      jobId: JOB_NAME
    });
    logger.info({ cron: config.worker.cron }, 'Scheduled repeatable ingestion job');
  } else {
    logger.info({ cron: exists.cron }, 'Repeatable job already scheduled');
  }

  const worker = buildWorker(async (job) => {
    logger.debug({ jobId: job.id }, 'Starting ingestion job');
    try {
      await processJob(job);
      jobCounter.inc({ status: 'success' });
    } catch (err) {
      logger.error({ err }, 'Ingestion job failed');
      jobCounter.inc({ status: 'failed' });
      throw err;
    }
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Ingestion job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Ingestion job failed');
  });

  const shutdown = async () => {
    logger.info('Shutting down ingestion worker');
    await worker.close();
    await disconnect();
    await closePool();
    await quitCache();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch((err) => {
  logger.error({ err }, 'Failed to start ingestion worker');
  process.exit(1);
});

