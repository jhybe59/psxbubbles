import http from 'node:http';
import { register, collectDefaultMetrics } from 'prom-client';
import { config } from './config.mjs';
import logger from './logger.mjs';

collectDefaultMetrics({ register });

let server;

export const startMetricsServer = () => {
  if (server) return server;
  server = http.createServer(async (req, res) => {
    if (req.url === '/healthz' || req.url === '/live') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.url !== '/metrics') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    try {
      const metrics = await register.metrics();
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(metrics);
    } catch (err) {
      logger.error({ err }, 'Failed to render metrics');
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error collecting metrics');
    }
  });

  server.listen(config.metrics.port, () => {
    logger.info({ port: config.metrics.port }, 'Metrics server listening');
  });

  return server;
};

export default startMetricsServer;

