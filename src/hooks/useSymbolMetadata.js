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
