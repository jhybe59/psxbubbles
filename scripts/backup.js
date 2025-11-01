#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

async function run() {
  try {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
    const projectName = pkg.name || path.basename(cwd);
    // store backups one level up so they survive repository-level deletes
    const backupsDir = path.resolve(cwd, '..', `${projectName}_backups`);
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${projectName}_${ts}.zip`;
    const outPath = path.join(backupsDir, filename);

    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`[backup] created ${outPath} (${archive.pointer()} bytes)`);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn('[backup] warning', err.message);
      else throw err;
    });
    archive.on('error', (err) => { throw err; });

    archive.pipe(output);

    // include everything except node_modules and existing backup folders and .zip files
    const relBackups = path.relative(cwd, backupsDir).replace(/\\/g, '/');
    archive.glob('**/*', {
      cwd,
      dot: true,
      ignore: [
        'node_modules/**',
        `${relBackups}/**`,
        '*.zip'
      ]
    });

    await archive.finalize();
  } catch (err) {
    console.error('[backup] error', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

run();
