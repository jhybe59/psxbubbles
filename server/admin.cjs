#!/usr/bin/env node
const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');

const app = express();
app.use(express.json());

const cwd = process.cwd();
const pkgPath = path.join(cwd, 'package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
const projectName = pkg.name || path.basename(cwd);
const backupsDir = path.resolve(cwd, '..', `${projectName}_backups`);
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

function createBackup(savePath) {
  return new Promise((resolve, reject) => {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${projectName}_${ts}.zip`;
      const outPath = savePath || path.join(backupsDir, filename);
      const output = fs.createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve({ path: outPath, bytes: archive.pointer() }));
      archive.on('warning', (err) => { if (err.code === 'ENOENT') console.warn('[admin] warning', err); else reject(err); });
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      const relBackups = path.relative(cwd, backupsDir).replace(/\\/g, '/');
      archive.glob('**/*', { cwd, dot: true, ignore: ['node_modules/**', `${relBackups}/**`, '*.zip'] });
      archive.finalize().catch(reject);
    } catch (err) { reject(err); }
  });
}

app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip')).sort().reverse();
    res.json({ backups: files, dir: backupsDir });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/backups/:name', (req, res) => {
  try {
    const name = req.params.name;
    const file = path.join(backupsDir, name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.download(file);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/backup', async (req, res) => {
  try {
    const result = await createBackup();
    res.json({ ok: true, file: path.basename(result.path), bytes: result.bytes });
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }); }
});

app.post('/api/restore', (req, res) => {
  try {
    const filename = req.body && req.body.filename;
    if (!filename) return res.status(400).json({ error: 'missing filename' });
    const selected = path.join(backupsDir, filename);
    if (!fs.existsSync(selected)) return res.status(404).json({ error: 'backup not found' });

    // make safety snapshot before restoring
    const safetyName = `${projectName}_pre_restore_${Date.now()}.zip`;
    const safetyPath = path.join(backupsDir, safetyName);
    // create a quick safety backup
    const output = fs.createWriteStream(safetyPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    const relBackups = path.relative(cwd, backupsDir).replace(/\\/g, '/');
    archive.glob('**/*', { cwd, dot: true, ignore: ['node_modules/**', `${relBackups}/**`, '*.zip'] });
    archive.finalize();

    // extract selected
    const zip = new AdmZip(selected);
    zip.extractAllTo(cwd, true);
    res.json({ ok: true, restored: filename, safety: safetyName });
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }); }
});

// Publish index map (authenticated)
app.post('/api/index_map', (req, res) => {
  try {
    // auth via Bearer token in Authorization header or ?token=
    const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || req.query.token;
    const token = (typeof auth === 'string' && auth.startsWith('Bearer ')) ? auth.slice(7) : auth;
    const expected = process.env.ADMIN_SECRET || process.env.INDEX_API_TOKEN;
    if (expected && String(token) !== String(expected)) return res.status(403).json({ ok: false, error: 'unauthorized' });

    const body = req.body;
    if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'invalid body' });

    // write to public/assets/migrated_index_map.json (atomic write)
    const outPath = path.join(cwd, 'public', 'assets', 'migrated_index_map.json');
    const tmpPath = outPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(body, null, 2), 'utf8');
    fs.renameSync(tmpPath, outPath);
    return res.json({ ok: true, path: outPath });
  } catch (err) { return res.status(500).json({ ok: false, error: String(err) }); }
});

const port = process.env.ADMIN_PORT || 4001;
app.listen(port, () => console.log(`[admin] backup server listening on http://localhost:${port} (backups dir: ${backupsDir})`));
