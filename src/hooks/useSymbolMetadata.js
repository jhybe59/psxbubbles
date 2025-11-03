import { useEffect, useState } from 'react';

const STORAGE_KEY = 'symbolMetadata_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
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
  const all = readAll();
  return all[symbol] || null;
}

export function setMetadata(symbol, meta) {
  if (!symbol) return false;
  const all = readAll();
  all[symbol] = Object.assign({}, all[symbol] || {}, meta);
  return writeAll(all);
}

export function removeMetadata(symbol) {
  if (!symbol) return false;
  const all = readAll();
  delete all[symbol];
  return writeAll(all);
}

export function importMetadata(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const all = readAll();
  const merged = Object.assign({}, all, obj);
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
          const res = await fetch('/assets/migrated_symbol_metadata.json', { cache: 'no-cache' });
          if (res && res.ok) {
            const json = await res.json();
            if (json && typeof json === 'object') {
              // merge into localStorage (preserve any existing keys just in case)
              const merged = Object.assign({}, readAll(), json);
              writeAll(merged);
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
