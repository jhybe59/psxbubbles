import { normaliseRow } from '../normalise.mjs';

describe('normaliseRow', () => {
  it('normalises PSX Terminal object payload', () => {
    const row = {
      symbol: 'HUBC',
      time: '2024-11-05T10:15:00Z',
      open: '72.40',
      high: '72.90',
      low: '71.80',
      close: '72.10',
      volume: '125000',
      turnover: '9025000',
      changePercent: '-0.55',
      dailyChangePercent: '-0.76'
    };

    const normalised = normaliseRow(row);

    expect(normalised).toEqual({
      symbol: 'HUBC',
      ts: Date.parse('2024-11-05T10:15:00Z'),
      open: 72.4,
      high: 72.9,
      low: 71.8,
      close: 72.1,
      volume: 125000,
      value: 9025000,
      daily_pct: -0.76,
      intervalPct: -0.55,
      raw: row
    });
  });

  it('normalises PSX Terminal array-derived payload', () => {
    const row = {
      symbol: 'OGDC',
      ts: 1730808600000,
      open: '125.10',
      high: '125.95',
      low: '124.80',
      close: '125.40',
      volume: '98500',
      turnover: '12345678',
      intervalPct: '-0.08',
      dailyPct: '-0.42'
    };

    const normalised = normaliseRow(row);

    expect(normalised).toEqual({
      symbol: 'OGDC',
      ts: 1730808600000,
      open: 125.1,
      high: 125.95,
      low: 124.8,
      close: 125.4,
      volume: 98500,
      value: 12345678,
      daily_pct: -0.42,
      intervalPct: -0.08,
      raw: row
    });
  });
});

