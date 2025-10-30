import { openDB } from 'idb';

const DB_NAME = 'psx-snapshots-db';
const DB_VERSION = 1;
const STORE_SNAP = 'snapshots';

let dbPromise = null;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SNAP)) {
          const store = db.createObjectStore(STORE_SNAP, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-symbol-ts', ['symbol', 'ts']);
          store.createIndex('by-ts', 'ts');
        }
      }
    });
  }
  return dbPromise;
}

export async function saveSnapshots(items = []) {
  // items: [{ symbol, market, ts (ms), price, volume, value, raw }]
  const db = await initDB();
  const tx = db.transaction(STORE_SNAP, 'readwrite');
  for (const it of items) {
    const rec = {
      symbol: it.symbol,
      market: it.market || 'REG',
      ts: it.ts || Date.now(),
      price: typeof it.price === 'number' ? it.price : (it.c != null ? Number(it.c) : null),
      volume: it.v != null ? it.v : (it.volume != null ? it.volume : null),
      value: it.val != null ? it.val : (it.value != null ? it.value : null),
      raw: it
    };
    await tx.store.add(rec);
  }
  await tx.done;
}

export async function getLatestAll() {
  const db = await initDB();
  // get distinct latest by symbol — naive approach: fetch all and reduce
  const all = await db.getAllFromIndex(STORE_SNAP, 'by-ts');
  if (!all || !all.length) return [];
  const map = new Map();
  for (const s of all) {
    const sym = s.symbol;
    const cur = map.get(sym);
    if (!cur || s.ts > cur.ts) map.set(sym, s);
  }
  return Array.from(map.values());
}

export async function getSnapshotAtOrBefore(symbol, ts) {
  const db = await initDB();
  const idx = db.transaction(STORE_SNAP).store.index('by-symbol-ts');
  // key range: [symbol, -inf] .. [symbol, ts]
  // idb doesn't support direct compound key cursors easily; use getAll with range
  const allForSymbol = await db.getAllFromIndex(STORE_SNAP, 'by-symbol-ts', IDBKeyRange.bound([symbol, 0], [symbol, ts]));
  if (!allForSymbol || !allForSymbol.length) return null;
  // pick the last (highest ts)
  let best = allForSymbol[0];
  for (const s of allForSymbol) if (s.ts > best.ts) best = s;
  return best;
}

export async function getRange(symbol, fromTs, toTs) {
  const db = await initDB();
  const res = await db.getAllFromIndex(STORE_SNAP, 'by-symbol-ts', IDBKeyRange.bound([symbol, fromTs], [symbol, toTs]));
  return res || [];
}

export async function getAllTimestamps() {
  const db = await initDB();
  // get all records ordered by ts and collect unique timestamps
  const all = await db.getAllFromIndex(STORE_SNAP, 'by-ts');
  if (!all || !all.length) return [];
  const set = new Set(all.map((r) => r.ts));
  return Array.from(set).sort((a, b) => a - b);
}

export async function purgeOlderThan(ts) {
  const db = await initDB();
  const tx = db.transaction(STORE_SNAP, 'readwrite');
  const idx = tx.store.index('by-ts');
  let cursor = await idx.openCursor();
  while (cursor) {
    if (cursor.value.ts < ts) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function purgeSnapshotsAt(ts) {
  const db = await initDB();
  const tx = db.transaction(STORE_SNAP, 'readwrite');
  const idx = tx.store.index('by-ts');
  let cursor = await idx.openCursor();
  while (cursor) {
    if (cursor.value.ts === ts) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function countSnapshots() {
  const db = await initDB();
  return db.count(STORE_SNAP);
}

export async function clearSnapshots() {
  const db = await initDB();
  const tx = db.transaction(STORE_SNAP, 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export default {
  initDB,
  saveSnapshots,
  getLatestAll,
  getSnapshotAtOrBefore,
  getRange,
  purgeOlderThan,
  purgeSnapshotsAt,
  countSnapshots,
  getAllTimestamps,
  clearSnapshots
};

// purgeSnapshotsAt is exported above as a named export already
