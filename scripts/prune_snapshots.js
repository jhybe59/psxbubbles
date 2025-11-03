#!/usr/bin/env node
// Simple snapshot pruner - reads a JSON array of snapshots and writes a pruned file
// Usage: node prune_snapshots.js --days 5 --in public/psx_snapshots.json --out public/psx_snapshots_pruned.json [--overwrite]

const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node prune_snapshots.js --days <days> --in <input.json> --out <output.json> [--overwrite]');
  process.exit(1);
}

const argv = process.argv.slice(2);
if (!argv.length) usage();

let days = 5;
let inFile = 'public/psx_snapshots.json';
let outFile = 'public/psx_snapshots_pruned.json';
let overwrite = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--days') { days = Number(argv[++i]); }
  else if (a === '--in') { inFile = argv[++i]; }
  else if (a === '--out') { outFile = argv[++i]; }
  else if (a === '--overwrite') { overwrite = true; }
  else usage();
}

if (!Number.isFinite(days) || days <= 0) {
  console.error('Invalid --days value');
  process.exit(2);
}

inFile = path.resolve(inFile);
outFile = path.resolve(outFile);

if (!fs.existsSync(inFile)) {
  console.error('Input file not found:', inFile);
  process.exit(2);
}

const stat = fs.statSync(inFile);
console.log('Input file size:', stat.size, 'bytes');

// Backup original
const backupPath = inFile + '.bak-' + Date.now();
fs.copyFileSync(inFile, backupPath);
console.log('Backup created at', backupPath);

console.log('Reading input file...');
const raw = fs.readFileSync(inFile, 'utf8');
let arr;
try {
  arr = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse JSON:', e.message);
  process.exit(3);
}

console.log('Total snapshots in file:', arr.length);

const cutoff = Date.now() - Math.round(days * 24 * 60 * 60 * 1000);
console.log('Keeping snapshots with ts >=', cutoff, '(last', days, 'days)');

const filtered = arr.filter((it) => {
  // accept numeric ts in ms or seconds
  if (it == null) return false;
  let ts = it.ts ?? it.t ?? it.timestamp ?? null;
  if (ts == null) return false;
  ts = Number(ts);
  // if ts seems to be in seconds (10-digit), convert to ms
  if (ts > 1e9 && ts < 1e11) ts = ts * 1000;
  return ts >= cutoff;
});

console.log('Snapshots kept:', filtered.length);

const outPath = overwrite ? inFile : outFile;
fs.writeFileSync(outPath, JSON.stringify(filtered, null, 2), 'utf8');
console.log('Wrote pruned snapshots to', outPath);

if (!overwrite) {
  console.log('Note: original file was backed up to', backupPath);
}
console.log('Done.');
