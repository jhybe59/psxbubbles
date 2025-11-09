import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'psx_api_' });

export const marketStatsRequests = new Counter({
  name: 'psx_api_market_stats_requests_total',
  help: 'Total number of market stats fetches',
  labelNames: ['cache', 'interval', 'index']
});

export const marketStatsDuration = new Histogram({
  name: 'psx_api_market_stats_duration_seconds',
  help: 'Latency of market stats fetches',
  labelNames: ['interval', 'index'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]
});

export const indicesRequests = new Counter({
  name: 'psx_api_indices_requests_total',
  help: 'Total number of indices snapshot requests',
  labelNames: ['cache']
});

export const indicesDuration = new Histogram({
  name: 'psx_api_indices_duration_seconds',
  help: 'Latency of indices snapshot fetches',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1]
});

export const metricsHandler = async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

export default {
  marketStatsRequests,
  marketStatsDuration,
  indicesRequests,
  indicesDuration,
  metricsHandler
};


