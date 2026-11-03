import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuoteFrame, QuoteOrderGuard, sourceLagMs } from './quote.mjs';

const receivedAt = new Date('2026-11-02T13:40:00.000Z');

test('normalizes current PSX Terminal quote tuples and seconds timestamps', () => {
  const result = normalizeQuoteFrame({
    type: 'snapshot',
    topic: 'quote:REG:OGDC',
    data: [['OGDC', 301.68, -5.1, -0.01662, 2751338, 833264351.93, 308.99, 300, 0, 0, 0, 0, 'OPN', 1793616586, 'REG']]
  }, { expectedSymbol: 'OGDC', receivedAt });

  assert.deepEqual(result.events, [{
    symbol: 'OGDC',
    sourceTimestamp: '2026-11-02T10:49:46.000Z',
    receivedAt: '2026-11-02T13:40:00.000Z',
    lastPrice: 301.68,
    cumulativeVolume: 2751338
  }]);
  assert.deepEqual(result.skipped, []);
  assert.equal(result.marketStatuses[0].status, 'OPN');
  assert.equal(sourceLagMs(result.events[0]), 10_214_000);
});

test('keeps source timestamp and volume null when missing in object updates', () => {
  const result = normalizeQuoteFrame({
    type: 'update',
    topic: 'quote:REG:OGDC',
    data: { symbol: 'OGDC', price: '301.50' }
  }, { expectedSymbol: 'OGDC', receivedAt });

  assert.deepEqual(result.events[0], {
    symbol: 'OGDC',
    sourceTimestamp: null,
    receivedAt: '2026-11-02T13:40:00.000Z',
    lastPrice: 301.5,
    cumulativeVolume: null
  });
});

test('skips malformed, price-less and unexpected-symbol rows with reasons', () => {
  const result = normalizeQuoteFrame({
    type: 'snapshot',
    data: [
      ['OGDC', null, 0, 0, 10],
      ['HBL', 100, 0, 0, 20],
      null
    ]
  }, { expectedSymbol: 'OGDC', receivedAt });

  assert.equal(result.events.length, 0);
  assert.deepEqual(result.skipped.map((entry) => entry.reason), [
    'missing_price',
    'unexpected_symbol',
    'invalid_quote_row'
  ]);
});

test('classifies duplicates and out-of-order updates', () => {
  const guard = new QuoteOrderGuard();
  const event = {
    symbol: 'OGDC',
    sourceTimestamp: '2026-11-02T13:40:00.000Z',
    lastPrice: 301.5,
    cumulativeVolume: 100
  };

  assert.equal(guard.inspect(event), null);
  assert.equal(guard.inspect({ ...event }), 'duplicate');
  assert.equal(guard.inspect({
    ...event,
    sourceTimestamp: '2026-11-02T13:39:59.000Z',
    lastPrice: 301
  }), 'out_of_order');
  assert.equal(guard.inspect({ ...event, cumulativeVolume: 110 }), null);
});

test('accepts millisecond timestamps and null cumulative volume', () => {
  const result = normalizeQuoteFrame({
    type: 'snapshot',
    data: [['OGDC', 301, 0, 0, null, null, 301, 300, 0, 0, 0, 0, 'CLS', 1793616586000, 'REG']]
  }, { expectedSymbol: 'OGDC', receivedAt });

  assert.equal(result.events[0].sourceTimestamp, '2026-11-02T10:49:46.000Z');
  assert.equal(result.events[0].cumulativeVolume, null);
  assert.equal(result.marketStatuses[0].status, 'CLS');
});
