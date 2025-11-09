import { normalizeSymbolKey, importMetadata, getMetadata, clearAllMetadata } from '../../src/hooks/useSymbolMetadata.js';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear()
  };
};

const listeners = new Map();

globalThis.localStorage = createMemoryStorage();
globalThis.window = {
  addEventListener: (event, handler) => listeners.set(event, handler),
  removeEventListener: (event) => listeners.delete(event),
  dispatchEvent: () => true,
  Event: class {}
};

describe('useSymbolMetadata helpers', () => {
  beforeEach(() => {
    clearAllMetadata();
  });

  test('normalizeSymbolKey uppercases and trims symbols', () => {
    expect(normalizeSymbolKey(' hubc ')).toBe('HUBC');
    expect(normalizeSymbolKey(null)).toBe('');
  });

  test('importMetadata merges incoming entries with normalized keys', () => {
    const incoming = {
      hubc: { displayName: 'Hubco' },
      HUBC: { shortName: 'HUBC' },
      '  ogdc ': { displayName: 'OGDC' }
    };

    const ok = importMetadata(incoming);
    expect(ok).toBe(true);
    expect(getMetadata('hubc')).toEqual({ displayName: 'Hubco', shortName: 'HUBC' });
    expect(getMetadata('OGDC')).toEqual({ displayName: 'OGDC' });
  });
});

