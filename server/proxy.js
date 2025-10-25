/* Simple local proxy to forward /api/* to https://psxterminal.com/api/*
   - Allows the browser to call http://localhost:3001/api/* without CORS problems
   - Usage: node server/proxy.js  (or npm run start-proxy)
*/

const express = require('express');
// Prefer global fetch (Node 18+). If not available, we will return an error
const cors = require('cors');
const app = express();
const PORT = process.env.PROXY_PORT || 3001;
const TARGET_BASE = process.env.PROXY_TARGET || 'https://psxterminal.com/api';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.all('/api/*', async (req, res) => {
  try {
    const path = req.path.replace(/^\/api/, '');
    const url = `${TARGET_BASE}${path}${req.url.includes('?') ? '' : ''}`;
    // forward querystring
    const qs = req.originalUrl.split('?')[1];
    const targetUrl = qs ? `${url}?${qs}` : url;

    const opts = {
      method: req.method,
      headers: { ...req.headers },
      redirect: 'follow',
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
    };
    // remove host header to avoid issues
    delete opts.headers.host;

    if (typeof fetch !== 'function') {
      throw new Error('global fetch is not available in this Node runtime. Please use Node 18+ or install node-fetch and re-add it as a dependency.');
    }
    const upstream = await fetch(targetUrl, opts);
    const contentType = upstream.headers.get('content-type') || '';
    const status = upstream.status;

    // stream JSON/text/binary back
    if (contentType.includes('application/json')) {
      const j = await upstream.json();
      res.status(status).json(j);
    } else if (contentType.includes('text/') || contentType === '') {
      const t = await upstream.text();
      res.status(status).send(t);
    } else {
      const buffer = await upstream.arrayBuffer();
      res.status(status).send(Buffer.from(buffer));
    }
  } catch (err) {
    console.error('Proxy error:', err && err.stack ? err.stack : err);
    res.status(502).json({ error: 'proxy_error', message: String(err && err.message ? err.message : err) });
  }
});

app.listen(PORT, () => {
  console.log(`Local PSX proxy listening on http://localhost:${PORT}/api -> ${TARGET_BASE}`);
});
