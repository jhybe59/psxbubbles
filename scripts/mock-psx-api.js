#!/usr/bin/env node
import http from 'node:http';

const port = Number(process.env.MOCK_PSX_PORT || 9000);

const sampleSymbols = [
  'HUBC', 'OGDC', 'PSX', 'HBL', 'LUCK', 'ENGRO', 'MCB', 'UBL', 'FATIMA', 'FFC',
  'SEARL', 'SYS', 'PAEL', 'NETSOL', 'TRG', 'SNGP', 'PSO', 'HASCOL', 'KOHC',
  'DGKC', 'MLCF', 'GATM', 'ILP', 'ASTL', 'INIL', 'HINOON', 'PPL', 'SHEL',
  'SILK', 'JPGL', 'EFERT', 'KEL', 'PKGS', 'EPCL', 'SITC', 'ATRL', 'APL',
  'MARI', 'AVN', 'HUMNL', 'PIBTL', 'PKGP', 'ANL', 'NCL', 'BLKC', 'SOOP', 'KTML', 'NRL', 'GHNL'
];

const now = () => Date.now();

const minuteBar = (symbol) => {
  const base = symbol.charCodeAt(0) * 1.3;
  const price = Number((base + Math.random() * 5).toFixed(2));
  const pct = Number(((Math.random() - 0.5) * 5).toFixed(2));
  return {
    symbol,
    ts: now(),
    open: price,
    high: Number((price + Math.random()).toFixed(2)),
    low: Number((price - Math.random()).toFixed(2)),
    close: price,
    volume: Math.floor(Math.random() * 100000),
    value: Number((price * 1000).toFixed(2)),
    daily_pct: pct,
    intervalPct: pct
  };
};

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/minute-bars')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbolsParam = url.searchParams.get('symbols');
    const symbols = symbolsParam ? symbolsParam.split(',').filter(Boolean) : sampleSymbols;
    const payload = symbols.map(minuteBar);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: payload }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-psx-api] listening on http://localhost:${port}`);
});

