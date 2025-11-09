import http from 'k6/http';
import { Trend } from 'k6/metrics';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 80 },
    { duration: '30s', target: 0 }
  ]
};

const latency = new Trend('market_stats_latency');
const INDEX_CODES = ['KSE100', 'KSE30', 'ALLSHR'];

export default function run() {
  const interval = Math.random() > 0.3 ? '5m' : 'Day';
  const index = Math.random() > 0.6 ? INDEX_CODES[Math.floor(Math.random() * INDEX_CODES.length)] : '';
  const params = {
    headers: { 'x-api-key': `${__ENV.API_KEY || 'dev-api-key'}` }
  };

  const statsUrl = `http://${__ENV.API_HOST || 'localhost:8080'}/api/market-stats?interval=${interval}${index ? `&index=${index}` : ''}`;
  const res = http.get(statsUrl, params);
  latency.add(res.timings.duration);

  if (Math.random() > 0.7) {
    http.get(`http://${__ENV.API_HOST || 'localhost:8080'}/api/market-stats/indices`, params);
  }

  sleep(0.5);
}


