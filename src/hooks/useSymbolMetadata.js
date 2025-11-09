import { useEffect, useState } from 'react';

const STORAGE_KEY = 'symbolMetadata_v1';

export function normalizeSymbolKey(symbol) {
  if (symbol == null) return '';
  return String(symbol).trim().toUpperCase();
}

function normalizeAllKeys(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const next = {};
  Object.entries(obj).forEach(([key, value]) => {
    const normalized = normalizeSymbolKey(key);
    if (!normalized) return;
    if (next[normalized]) {
      next[normalized] = Object.assign({}, next[normalized], value || {});
    } else {
      next[normalized] = value || {};
    }
  });
  return next;
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return normalizeAllKeys(parsed);
  } catch (e) {
    return {};
  }
}

function writeAll(obj) {
  try {
    const normalized = normalizeAllKeys(obj);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    // fire a storage-like event locally so listeners update in same tab
    try {
      window.dispatchEvent(new Event('symbolMetadataUpdated'));
    } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

export function getAllMetadata() {
  return readAll();
}

export function getMetadata(symbol) {
  if (!symbol) return null;
  const key = normalizeSymbolKey(symbol);
  const all = readAll();
  return all[key] || null;
}

export function setMetadata(symbol, meta) {
  if (!symbol) return false;
  const key = normalizeSymbolKey(symbol);
  const all = readAll();
  all[key] = Object.assign({}, all[key] || {}, meta);
  return writeAll(all);
}

export function removeMetadata(symbol) {
  if (!symbol) return false;
  const key = normalizeSymbolKey(symbol);
  const all = readAll();
  delete all[key];
  return writeAll(all);
}

export function importMetadata(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const normalizedIncoming = normalizeAllKeys(obj);
  const all = readAll();
  const merged = Object.assign({}, all, normalizedIncoming);
  return writeAll(merged);
}

export function clearAllMetadata() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('symbolMetadataUpdated'));
    return true;
  } catch (e) {
    return false;
  }
}

// React hook to subscribe to a symbol's metadata
export function useSymbolMetadata(symbol) {
  const [meta, setMeta] = useState(() => getMetadata(symbol));

  useEffect(() => {
    function onUpdate() {
      setMeta(getMetadata(symbol));
    }
    window.addEventListener('symbolMetadataUpdated', onUpdate);
    window.addEventListener('storage', onUpdate);
    // initial read
    onUpdate();
    return () => {
      window.removeEventListener('symbolMetadataUpdated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [symbol]);

  const set = (m) => setMetadata(symbol, m);
  const remove = () => removeMetadata(symbol);

  return [meta, set, remove];
}

export default {
  getAllMetadata,
  getMetadata,
  setMetadata,
  removeMetadata,
  importMetadata,
  clearAllMetadata
};

// On first load in the browser, if no metadata is present in localStorage,
// attempt to import the static migrated metadata file generated at
// `public/assets/migrated_symbol_metadata.json`. This makes logos available
// for fresh visitors (e.g. production deployed site) without requiring the
// per-browser localStorage export that the dev copy may have.
// The fetch is async; when it writes into localStorage it dispatches the
// `symbolMetadataUpdated` event so components subscribed via the hook will
// re-read and re-render with logos.
  if (typeof window !== 'undefined') {
  try {
    const existing = readAll();
    if (!existing || Object.keys(existing).length === 0) {
      (async () => {
        try {
          const candidates = ['/api/symbol_metadata', '/assets/migrated_symbol_metadata.json'];
          for (let i = 0; i < candidates.length; i += 1) {
            const url = candidates[i];
            try {
              const res = await fetch(url, { cache: 'no-cache' });
              if (!res || !res.ok) continue;
              const json = await res.json();
              const payload = json && json.data && typeof json.data === 'object' ? json.data : json;
              if (payload && typeof payload === 'object') {
                const merged = Object.assign({}, readAll(), payload);
                writeAll(merged);
                break;
              }
            } catch (fetchErr) {
              // try next candidate
            }
          }
        } catch (e) {
          // ignore fetch errors (best-effort fallback)
        }
      })();
    }
  } catch (e) {
    // ignore
  }
}
