#!/usr/bin/env node
// Development bootstrap: one command to spin up stack, run migrations, seed, and start frontend.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const envFile = path.join(projectRoot, '.env');
const exampleEnv = path.join(projectRoot, 'config', 'env.example');

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  child.on('exit', (code) => {
    if (code === 0) return resolve();
    reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code}`));
  });
});

const waitForPort = async (port, host = '127.0.0.1', timeoutMs = 30000) => {
  const start = Date.now();
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection(port, host);
      socket.once('connect', () => { socket.end(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, 750);
        }
      });
    };
    attempt();
  });
};

const main = async () => {
  console.log('[bootstrap-dev] Starting bootstrap');
  if (!fs.existsSync(envFile)) {
    console.log('[bootstrap-dev] Creating .env from config/env.example');
    fs.copyFileSync(exampleEnv, envFile);
  }

  // Ensure dependencies installed
  if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
    console.log('[bootstrap-dev] Installing npm dependencies');
    await run('npm', ['install']);
  }

  console.log('[bootstrap-dev] Bringing up docker compose stack');
  await run('npm', ['run', 'dev:stack']);

  console.log('[bootstrap-dev] Waiting for QuestDB PG Port (8812)');
  try { await waitForPort(8812); } catch (e) { console.warn('[bootstrap-dev] DB wait warning:', e.message); }

  console.log('[bootstrap-dev] Initializing QuestDB tables');
  try { await run('npm', ['run', 'db:create-questdb']); } catch (e) { console.warn('[bootstrap-dev] QuestDB init warning:', e.message); }

  console.log('[bootstrap-dev] Applying PostgreSQL migrations (optional for QuestDB mode)');
  try {
    await run('npm', ['run', 'db:migrate']);
  } catch (e) {
    console.warn('[bootstrap-dev] PostgreSQL migration warning (non-fatal):', e.message);
  }

  console.log('[bootstrap-dev] Seeding development data');
  try { await run('npm', ['run', 'db:seed']); } catch (e) { console.warn('[bootstrap-dev] Seed warning:', e.message); }

  console.log('[bootstrap-dev] Starting frontend (Vite)');
  // Start Vite dev server last; keep it attached
  await run('npm', ['run', 'dev']);
};

main().catch(err => {
  console.error('[bootstrap-dev] Failed:', err.message);
  process.exit(1);
});
