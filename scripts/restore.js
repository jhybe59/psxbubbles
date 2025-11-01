#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import AdmZip from 'adm-zip';

function questionAsync(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

async function run() {
  try {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
    const projectName = pkg.name || path.basename(cwd);
    const backupsDir = path.resolve(cwd, '..', `${projectName}_backups`);
    if (!fs.existsSync(backupsDir)) {
      console.error('[restore] no backups directory found:', backupsDir);
      process.exitCode = 1;
      return;
    }

    const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip')).sort().reverse();
    if (!files.length) {
      console.error('[restore] no backup files found in', backupsDir);
      process.exitCode = 1;
      return;
    }

    let pick = process.argv[2];
    if (!pick) {
      console.log('[restore] available backups:');
      files.forEach((f, i) => console.log(`${i + 1}) ${f}`));
      const ans = await questionAsync('Enter number to restore: ');
      const idx = Number(ans) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= files.length) {
        console.error('[restore] invalid selection');
        process.exitCode = 1;
        return;
      }
      pick = files[idx];
    }

    const selectedPath = path.join(backupsDir, pick);
    if (!fs.existsSync(selectedPath)) {
      console.error('[restore] selected backup not found:', selectedPath);
      process.exitCode = 1;
      return;
    }

    console.log('[restore] selected:', selectedPath);
    const ans = await questionAsync('This will overwrite files in the current directory. Type YES to continue: ');
    if (ans !== 'YES') {
      console.log('[restore] aborting');
      return;
    }

    const zip = new AdmZip(selectedPath);
    zip.extractAllTo(cwd, true);
    console.log('[restore] completed. Extracted to', cwd);
  } catch (err) {
    console.error('[restore] error', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

run();
