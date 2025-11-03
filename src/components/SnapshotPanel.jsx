import React, { useEffect, useState } from 'react';
import storage from '../lib/storage';

function humanDate(ts) {
  try {
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function SnapshotPanel({ open = true, onClose = null, onImported = null }) {
  const [importedTs, setImportedTs] = useState([]);
  const [availableMap, setAvailableMap] = useState(new Map());
  const [selectedToImport, setSelectedToImport] = useState(new Set());
  const [selectedToDelete, setSelectedToDelete] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // small helper to avoid hanging IDB ops: race against a timeout
  function withTimeout(promise, ms = 15000) {
    let id;
    const timeout = new Promise((_, reject) => {
      id = setTimeout(() => reject(new Error('operation timed out')), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(id)), timeout]);
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const tsList = await storage.getAllTimestamps();
        setImportedTs(tsList || []);
      } catch (e) {
        setImportedTs([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // fetch a pruned snapshots file (smaller) and build a map of ts -> count
    (async () => {
      try {
        setError(null);
        const res = await fetch('/psx_snapshots_pruned.json');
        if (!res.ok) {
          setAvailableMap(new Map());
          return;
        }
        const list = await res.json();
        const map = new Map();
        for (const r of list) {
          const t = r.ts || r.ts_ms || r.ts_ms || r.ts_ms || r.ts || null;
          const key = Number(r.ts || r.ts_ms || r.ts_ms || r.ts || 0);
          if (!map.has(key)) map.set(key, 0);
          map.set(key, map.get(key) + 1);
        }
        // ensure keys are sorted ascending
        const sorted = new Map(Array.from(map.entries()).sort((a, b) => a[0] - b[0]));
        setAvailableMap(sorted);
      } catch (e) {
        setAvailableMap(new Map());
      }
    })();
  }, [open]);

  async function handleImport() {
    if (!selectedToImport.size) return;
    setLoading(true);
    setError(null);
    try {
      // fetch full pruned JSON and filter by selected timestamps
      const res = await fetch('/psx_snapshots_pruned.json');
      if (!res.ok) throw new Error('failed to fetch snapshots');
      const list = await res.json();
      const sel = new Set(selectedToImport);
      const toSave = list.filter((r) => sel.has(Number(r.ts)));
      // map to storage expected shape
      const items = toSave.map((r) => ({ symbol: r.symbol, market: r.market || 'PSX', ts: r.ts, price: r.price, volume: r.volume, value: null, raw: r }));
      const BATCH = 800;
      for (let i = 0; i < items.length; i += BATCH) {
        await storage.saveSnapshots(items.slice(i, i + BATCH));
      }
      // refresh imported list
      const tsList = await storage.getAllTimestamps();
      setImportedTs(tsList || []);
      setSelectedToImport(new Set());
      if (onImported) onImported();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedToDelete.size) return;
    setLoading(true);
    setError(null);
    const results = [];
    try {
      for (const t of Array.from(selectedToDelete)) {
        try {
          // guard each purge with a timeout so one stuck cursor doesn't block the whole UI
          await withTimeout(storage.purgeSnapshotsAt(Number(t)), 10000);
          results.push({ ts: t, ok: true });
        } catch (innerErr) {
          results.push({ ts: t, ok: false, error: innerErr.message || String(innerErr) });
        }
      }
      // refresh imported list
      try {
        const tsList = await withTimeout(storage.getAllTimestamps(), 8000);
        setImportedTs(tsList || []);
      } catch (e) {
        // non-fatal
      }
      // clear selection for those successfully deleted
      const failed = results.filter((r) => !r.ok).map((r) => String(r.ts));
      if (failed.length) {
        setSelectedToDelete(new Set(failed));
        setError(`Failed to delete ${failed.length} timestamp(s).`);
      } else {
        setSelectedToDelete(new Set());
      }
      if (onImported) onImported();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleSet(setState, key) {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', right: 18, top: 72, width: 520, maxHeight: '70vh', overflow: 'auto', background: 'rgba(12,16,18,0.96)', color: '#fff', padding: 12, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 2000 }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <strong>Snapshots</strong>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => { if (onClose) onClose(); }} style={{background:'transparent',border:'1px solid #2b3b38',color:'#9fb8b0',padding:'6px 8px',borderRadius:6}}>Close</button>
        </div>
      </div>
      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Imported</div>
          <div style={{background:'rgba(255,255,255,0.02)',padding:8,borderRadius:6,maxHeight:320,overflow:'auto'}}>
            {importedTs && importedTs.length ? importedTs.slice().reverse().map((t) => (
              <label key={t} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px'}}>
                <span style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="checkbox" checked={selectedToDelete.has(String(t))} onChange={() => toggleSet(setSelectedToDelete, String(t))} />
                  <span style={{fontSize:12}}>{humanDate(t)}</span>
                </span>
                <span style={{fontSize:12,color:'#9fb8b0'}}> — {''}</span>
              </label>
            )) : <div style={{color:'#8d9b95'}}>No snapshots imported</div>}
          </div>
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <button onClick={handleDelete} disabled={loading || selectedToDelete.size === 0} style={{padding:'8px 10px',borderRadius:6,background:'#8b2a2a',border:'none',color:'#fff'}}>Delete Selected</button>
            <button onClick={async () => { await storage.clearSnapshots(); const tsList = await storage.getAllTimestamps(); setImportedTs(tsList || []); if (onImported) onImported(); }} style={{padding:'8px 10px',borderRadius:6,background:'#333',border:'1px solid #2b3b38',color:'#fff'}}>Clear All</button>
          </div>
        </div>
        <div style={{width:2,background:'rgba(255,255,255,0.03)'}} />
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Available to import</div>
          <div style={{background:'rgba(255,255,255,0.02)',padding:8,borderRadius:6,maxHeight:320,overflow:'auto'}}>
            {Array.from(availableMap.entries()).length ? Array.from(availableMap.entries()).reverse().map(([ts, cnt]) => (
              <label key={ts} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px'}}>
                <span style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="checkbox" checked={selectedToImport.has(String(ts))} onChange={() => toggleSet(setSelectedToImport, String(ts))} />
                  <span style={{fontSize:12}}>{humanDate(ts)}</span>
                </span>
                <span style={{fontSize:12,color:'#9fb8b0'}}>{cnt} items</span>
              </label>
            )) : <div style={{color:'#8d9b95'}}>No available snapshots found in public file</div>}
          </div>
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <button onClick={handleImport} disabled={loading || selectedToImport.size === 0} style={{padding:'8px 10px',borderRadius:6,background:'#2a7b3a',border:'none',color:'#fff'}}>Import Selected</button>
            <button onClick={async () => { setSelectedToImport(new Set(Array.from(availableMap.keys()).map(String))); }} style={{padding:'8px 10px',borderRadius:6,background:'#333',border:'1px solid #2b3b38',color:'#fff'}}>Select All</button>
          </div>
        </div>
      </div>
      {loading && <div style={{marginTop:8}}>Working…</div>}
      {error && <div style={{marginTop:8,color:'#ff9b9b'}}>Error: {error}</div>}
    </div>
  );
}
