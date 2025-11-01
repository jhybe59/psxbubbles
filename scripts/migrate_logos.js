#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node scripts/migrate_logos.js <exported-metadata.json>');
  console.log('This will extract data-URI images and write them to public/assets/logos/ and produce a migrated metadata JSON.');
}

async function run() {
  const infile = process.argv[2];
  if (!infile) {
    usage();
    process.exit(1);
  }
  const absIn = path.isAbsolute(infile) ? infile : path.join(process.cwd(), infile);
  if (!fs.existsSync(absIn)) {
    console.error('Input file not found:', absIn);
    process.exit(1);
  }

  const raw = fs.readFileSync(absIn, 'utf8');
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.error('Invalid JSON'); process.exit(1); }

  const logosDir = path.join(process.cwd(), 'public', 'assets', 'logos');
  fs.mkdirSync(logosDir, { recursive: true });

  const out = {};
  for (const [sym, meta] of Object.entries(obj)) {
    if (!meta || typeof meta !== 'object') { out[sym] = meta; continue; }
    const img = meta.image;
    if (!img || typeof img !== 'string') { out[sym] = meta; continue; }

    if (!img.startsWith('data:')) {
      // already a URL/path - keep as-is
      out[sym] = meta;
      continue;
    }

    // data URI: data:[<mediatype>][;base64],<data>
    const m = img.match(/^data:([^;]+)(;base64)?,(.*)$/s);
    if (!m) { console.warn('[migrate] unsupported data URI for', sym); out[sym] = meta; continue; }
    const mime = m[1];
    const isBase64 = !!m[2];
    const payload = m[3];

    let ext = 'bin';
    if (mime === 'image/svg+xml') ext = 'svg';
    else if (mime === 'image/png') ext = 'png';
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
    else if (mime === 'image/webp') ext = 'webp';

    const safeSym = (sym || 'untitled').replace(/[^a-z0-9-_\.]/gi, '_');
    const filename = `${safeSym}.${ext}`;
    const outPath = path.join(logosDir, filename);
    try {
      if (isBase64) {
        const buf = Buffer.from(payload, 'base64');
        fs.writeFileSync(outPath, buf);
      } else {
        // percent-encoded or raw text (SVGs commonly)
        const text = decodeURIComponent(payload);
        if (ext === 'svg') fs.writeFileSync(outPath, text, 'utf8');
        else fs.writeFileSync(outPath, Buffer.from(text));
      }
      const nextMeta = Object.assign({}, meta, { image: `/assets/logos/${filename}` });
      out[sym] = nextMeta;
      console.log('[migrate] wrote', outPath);
    } catch (e) {
      console.error('[migrate] failed to write', outPath, e && e.message);
      out[sym] = meta;
    }
  }

  const outFile = path.join(process.cwd(), 'public', 'assets', 'migrated_symbol_metadata.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log('[migrate] migrated metadata written to', outFile);
  console.log('[migrate] Next: copy the migrated JSON into the Symbols Panel via Import or move it into your workflow and optionally replace localStorage value.');
}

run().catch((e) => { console.error(e); process.exit(1); });
