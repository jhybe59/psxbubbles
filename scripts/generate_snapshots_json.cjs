const fs = require('fs');
const path = require('path');

// Simple CSV parser (handles commas, not full RFC quoting) - enough for current files
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < header.length) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = parts[j] ? parts[j].trim() : '';
    rows.push(obj);
  }
  return { header, rows };
}

function extractDateFromFilename(name) {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const inDir = path.resolve(__dirname, '..', 'OHLCV');
  const outFile = path.resolve(__dirname, '..', 'public', 'psx_snapshots.json');
  const dates = [];

  function walk(dir) {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of list) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.csv')) dates.push(full);
    }
  }

  walk(inDir);
  dates.sort();

  const out = [];
  for (const f of dates) {
    const name = path.basename(f);
    const dateStr = extractDateFromFilename(name);
    if (!dateStr) continue;
    const ts = new Date(dateStr + 'T00:00:00Z').getTime();
    const txt = fs.readFileSync(f, 'utf8');
    const parsed = parseCSV(txt);
    for (const r of parsed.rows) {
      const symbol = r['Symbol'] || r['symbol'] || r['SYMBOL'];
      if (!symbol) continue;
      const price = toNumber(r['Price'] || r['price'] || r['Close'] || r['close']);
      const volume = toNumber(r['Volume 1 day'] || r['Volume'] || r['volume']);
      const pct1d = toNumber(r['Price Change % 1 day'] || r['Price Change % 1 Day'] || r['Price Change %'] || r['Price Change % 1 day']);
      out.push({ symbol: String(symbol).trim(), market: 'PSX', ts, price, volume, daily_pct: pct1d, raw: r });
    }
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} snapshots to ${outFile}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
