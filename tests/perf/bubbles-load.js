import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.BUBBLES_BASE_URL || 'http://localhost:8080/api';
const API_KEY = __ENV.BUBBLES_API_KEY || 'dev-api-key';
const INTERVALS = ['1m', '5m', '15m', '1h', 'Day'];
const FAVORITES = ['HUBC', 'OGDC', 'PSX', 'HBL', 'LUCK'];

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 120 },
    { duration: '2m', target: 0 }
  ]
};

function request(interval) {
  const url = `${API_BASE}/bubbles?interval=${interval}`;
  const res = http.get(url, {
    headers: { 'x-api-key': API_KEY }
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'has symbols': (r) => r.json('symbols')?.length >= 0
  });
}

export default function () {
  const interval = INTERVALS[Math.floor(Math.random() * INTERVALS.length)];
  request(interval);
  // simulate metadata calls occasionally
  if (Math.random() < 0.3) {
    http.get(`${API_BASE}/indices`, { headers: { 'x-api-key': API_KEY } });
    http.get(`${API_BASE}/snapshots?interval=${interval}`, { headers: { 'x-api-key': API_KEY } });
  }
  sleep(1);
}

