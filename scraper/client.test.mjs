import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { encode } from 'msgpackr';
import { createQuoteScraper } from './client.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs = 1_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail('Timed out waiting for expected scraper event');
}

test('subscribes, writes a quote, answers ping, reports stale data, and reconnects', async () => {
  const sockets = [];
  const output = [];
  const diagnostics = [];
  let tokenRequests = 0;

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;

    constructor(url, options) {
      super();
      assert.match(url, /^wss:\/\/feed\.example\/rt\?t=token-/);
      assert.equal(options.headers.Origin, 'https://feed.example');
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
      setTimeout(() => {
        this.readyState = 1;
        this.emit('open');
        this.emit('message', encode({ type: 'hello' }));
      }, 0);
    }

    send(raw) {
      this.sent.push(raw);
      const message = JSON.parse(raw);
      if (message.op === 'subscribe') {
        setTimeout(() => {
          this.emit('message', encode({ type: 'subscribed', topics: message.topics }));
          this.emit('message', encode({
            type: 'snapshot',
            topic: 'quote:REG:OGDC',
            data: [['OGDC', 301.68, 0, 0, 10_000, 0, 302, 300, 0, 0, 0, 0, 'CLS', 1793616586, 'REG']]
          }));
          this.emit('message', encode({ type: 'ping' }));
        }, 0);
      }
    }

    close(code = 1000) {
      if (this.readyState === 3) return;
      this.readyState = 3;
      setTimeout(() => this.emit('close', code, Buffer.alloc(0)), 0);
    }

    disconnectUnexpectedly() {
      this.readyState = 3;
      this.emit('close', 1006, Buffer.alloc(0));
    }
  }

  const scraper = createQuoteScraper({
    symbol: 'OGDC',
    market: 'REG',
    baseUrl: 'https://feed.example',
    fetchImpl: async () => {
      tokenRequests += 1;
      return { ok: true, json: async () => ({ token: `token-${tokenRequests}` }) };
    },
    WebSocketImpl: MockWebSocket,
    writeLine: (line) => output.push(JSON.parse(line)),
    log: (level, event, details) => diagnostics.push({ level, event, details }),
    retryBaseMs: 10,
    retryMaxMs: 30,
    staleAfterMs: 40,
    heartbeatTimeoutMs: 1_000,
    random: () => 0.5
  });

  try {
    scraper.start();
    await waitFor(() => output.length === 1 && sockets[0]?.sent.some((raw) => JSON.parse(raw).op === 'pong'));
    assert.deepEqual(output[0], {
      symbol: 'OGDC',
      sourceTimestamp: '2026-11-02T10:49:46.000Z',
      receivedAt: new Date(output[0].receivedAt).toISOString(),
      lastPrice: 301.68,
      cumulativeVolume: 10_000
    });
    assert.ok(diagnostics.some((item) => item.event === 'market_not_open'));

    await waitFor(() => diagnostics.some((item) => item.event === 'data_stale'));
    sockets[0].disconnectUnexpectedly();
    await waitFor(() => sockets.length === 2 && diagnostics.filter((item) => item.event === 'subscribed').length >= 2);
    await waitFor(() => diagnostics.some((item) => item.event === 'quote_duplicate'));
    assert.equal(tokenRequests, 2);
    assert.ok(diagnostics.some((item) => item.event === 'quote_duplicate'));
  } finally {
    scraper.stop();
  }
});

test('subscribes to a configured symbol list on one socket and routes quote frames', async () => {
  const sockets = [];
  const output = [];
  const diagnostics = [];

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;

    constructor() {
      super();
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
      setTimeout(() => {
        this.readyState = 1;
        this.emit('open');
        this.emit('message', encode({ type: 'hello' }));
      }, 0);
    }

    send(raw) {
      this.sent.push(raw);
      const message = JSON.parse(raw);
      if (message.op !== 'subscribe') return;
      setTimeout(() => {
        this.emit('message', encode({ type: 'subscribed', topics: message.topics }));
        for (const symbol of ['LOADS', 'BECO', 'CNERGY', 'OGDC', 'DGKC']) {
          this.emit('message', encode({
            type: 'snapshot',
            topic: `quote:REG:${symbol}`,
            data: [[symbol, 10, 0, 0, 100, 0, 11, 9, 0, 0, 0, 0, 'OPN', 1793616586, 'REG']]
          }));
        }
      }, 0);
    }

    close(code = 1000) {
      if (this.readyState === 3) return;
      this.readyState = 3;
      setTimeout(() => this.emit('close', code, Buffer.alloc(0)), 0);
    }
  }

  const scraper = createQuoteScraper({
    symbols: 'loads, BECO, CNERGY, OGDC, DGKC, OGDC',
    market: 'REG',
    baseUrl: 'https://feed.example',
    fetchImpl: async () => ({ ok: true, json: async () => ({ token: 'token' }) }),
    WebSocketImpl: MockWebSocket,
    writeLine: (line) => output.push(JSON.parse(line)),
    log: (level, event, details) => diagnostics.push({ level, event, details })
  });

  try {
    scraper.start();
    await waitFor(() => output.length === 5);
    const subscribe = sockets[0].sent.map((raw) => JSON.parse(raw)).find((message) => message.op === 'subscribe');
    assert.deepEqual(subscribe.topics, [
      'quote:REG:LOADS', 'quote:REG:BECO', 'quote:REG:CNERGY', 'quote:REG:OGDC', 'quote:REG:DGKC'
    ]);
    assert.deepEqual(output.map((event) => event.symbol), ['LOADS', 'BECO', 'CNERGY', 'OGDC', 'DGKC']);
    assert.equal(sockets.length, 1);
    assert.ok(diagnostics.some((item) => item.event === 'subscribed'));
  } finally {
    scraper.stop();
  }
});
