import React, { useState, useMemo, useEffect, useRef } from 'react'
import { normalizeIndexSymbol, sanitizeIndexMap } from '../utils/indexMap'

export default function IndexManager({ open, onClose, coins = [], indexMap = {}, setIndexMap, onPublishSuccess }) {
  const indices = ['KSE 100','KSE 30','ALLSHR','KMI 30','KMIALLSHR'];
  const [activeIndex, setActiveIndex] = useState(indices[0]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [dirty, setDirty] = useState(false);
  const [publishStatus, setPublishStatus] = useState({ state: 'idle', message: 'No changes yet.' });
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const publishTimerRef = useRef(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('indexPublishToken') || '';
    } catch (e) {
      return '';
    }
  });
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const AUTO_PUBLISH_DELAY = 1200;

  const persistToken = (value) => {
    const trimmed = value ? value.trim() : '';
    setToken(trimmed);
    tokenRef.current = trimmed;
    try {
      if (trimmed) localStorage.setItem('indexPublishToken', trimmed);
      else localStorage.removeItem('indexPublishToken');
    } catch (e) {
      // ignore storage errors
    }
  };

  const updateStatus = (state, message) => {
    setPublishStatus({ state, message });
  };

  const schedulePublish = () => {
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    publishTimerRef.current = setTimeout(() => {
      publishTimerRef.current = null;
      publishIndexMap({ mode: 'auto' });
    }, AUTO_PUBLISH_DELAY);
  };

  const markDirty = () => {
    setDirty(true);
    updateStatus('dirty', 'Local changes pending publish');
    schedulePublish();
  };

  const persistIndexMap = (next, { shouldMarkDirty = true } = {}) => {
    const sanitized = sanitizeIndexMap(next);
    const currentSanitized = sanitizeIndexMap(indexMap || {});
    if (JSON.stringify(sanitized) === JSON.stringify(currentSanitized)) return;
    setIndexMap(sanitized);
    try {
      localStorage.setItem('indexMap', JSON.stringify(sanitized));
    } catch (e) {
      // ignore
    }
    if (shouldMarkDirty) markDirty();
  };

  useEffect(() => {
    if (!open) return;
    setActiveIndex(indices[0]);
    setSearch('');
    setSelected(new Set());
  }, [open]);

  useEffect(() => () => {
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
  }, []);

  // Export current indexMap to a downloadable JSON file
  function exportIndexMap() {
    try {
      const data = JSON.stringify(sanitizeIndexMap(indexMap || {}), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index_map.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  }

  // Import index map JSON via paste prompt (simple UX for admins). This will
  // replace the in-memory indexMap and write to localStorage so other tabs
  // and subsequent visits pick it up.
  function importIndexMap() {
    try {
      const text = prompt('Paste JSON for full index map (will replace current)');
      if (!text) return;
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return alert('Invalid JSON');
      persistIndexMap(parsed);
      alert('Index map imported');
    } catch (e) {
      alert('Failed to import index map: ' + (e && e.message ? e.message : e));
    }
  }

  async function publishIndexMap({ mode = 'manual', forcePrompt = false } = {}) {
    try {
      if (publishTimerRef.current) {
        clearTimeout(publishTimerRef.current);
        publishTimerRef.current = null;
      }
      let currentToken = tokenRef.current;
      if ((forcePrompt || !currentToken) && mode === 'manual') {
        const entered = prompt('Enter publish token (admin secret)', currentToken || '');
        if (!entered) {
          updateStatus('token-missing', 'Publish cancelled: no token provided');
          return;
        }
        currentToken = entered.trim();
        persistToken(currentToken);
      }

      if (!currentToken) {
        updateStatus('token-missing', 'Set the admin token to publish changes');
        return;
      }

      const payload = sanitizeIndexMap(indexMap || {});
      updateStatus('pending', mode === 'auto' ? 'Publishing changes…' : 'Publishing index map…');

      const res = await fetch('/api/index_map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + currentToken
        },
        body: JSON.stringify(payload)
      });

      let json = null;
      try {
        json = await res.json();
      } catch (err) {
        // ignore parse errors (may occur on empty body)
      }

      if (!res.ok) {
        const errMsg = (json && json.error) ? json.error : res.statusText;
        if (res.status === 403) {
          persistToken('');
          updateStatus('error', 'Publish blocked: token rejected by server');
          if (mode === 'manual') {
            return publishIndexMap({ mode: 'manual', forcePrompt: true });
          }
          return;
        }
        updateStatus('error', `Publish failed: ${errMsg}`);
        return;
      }

      setDirty(false);
      const ts = Date.now();
      setLastPublishedAt(ts);
      updateStatus('success', `Published successfully at ${new Date(ts).toLocaleTimeString()}`);
      if (typeof onPublishSuccess === 'function') {
        // pass through the payload to the caller (strip wrapper if present)
        const data = json && json.data ? json.data : payload;
        onPublishSuccess(data);
      }
    } catch (e) {
      updateStatus('error', `Publish error: ${e && e.message ? e.message : String(e)}`);
    }
  }

  const members = (indexMap && indexMap[activeIndex]) ? indexMap[activeIndex] : [];
  const memberSet = useMemo(() => {
    const set = new Set();
    (members || []).forEach((m) => {
      const normalized = normalizeIndexSymbol(m);
      if (normalized) set.add(normalized);
    });
    return set;
  }, [members]);
  const statusColorMap = {
    idle: '#9fb8b0',
    pending: '#9fb8b0',
    dirty: '#f5c16c',
    'token-missing': '#f5c16c',
    success: '#6fe987',
    error: '#ff9b9b'
  };
  const statusColor = statusColorMap[publishStatus.state] || '#9fb8b0';
  const tokenPreview = token ? `${token.slice(0, Math.min(4, token.length))}${token.length > 4 ? '…' : ''}` : 'not set';
  const lastPublishedText = lastPublishedAt ? new Date(lastPublishedAt).toLocaleString() : null;

  const available = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return coins
      .filter((c) => {
        const sym = normalizeIndexSymbol(c.symbol || c.id || '');
        return sym && !memberSet.has(sym);
      })
      .filter(c => !q || (c.symbol || c.id || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q))
      .slice(0, 300);
  }, [coins, memberSet, search]);

  function saveForIndex(ix, arr) {
    const normalizedMembers = Array.from(new Set((arr || []).map((m) => normalizeIndexSymbol(m)).filter(Boolean)));
    const existing = Array.isArray(indexMap[ix]) ? Array.from(new Set(indexMap[ix].map((m) => normalizeIndexSymbol(m)).filter(Boolean))) : [];
    if (normalizedMembers.length === existing.length && normalizedMembers.every((m, i) => m === existing[i])) return;
    const next = Object.assign({}, indexMap, { [ix]: normalizedMembers });
    persistIndexMap(next);
  }

  function addSymbol(sym) {
    const key = normalizeIndexSymbol(sym);
    if (!key) return;
    const arr = Array.from(new Set([...(members || []), key]));
    saveForIndex(activeIndex, arr);
  }

  function removeSymbol(sym) {
    const key = normalizeIndexSymbol(sym);
    const arr = (members || []).filter((s) => normalizeIndexSymbol(s) !== key);
    saveForIndex(activeIndex, arr);
  }

  function addSelectedBulk() {
    const arr = Array.from(new Set([...(members || []), ...Array.from(selected).map((s) => normalizeIndexSymbol(s))])).filter(Boolean);
    saveForIndex(activeIndex, arr);
    setSelected(new Set());
  }

  function handleSetToken() {
    const entered = prompt('Set admin publish token (Bearer secret)', tokenRef.current || '');
    if (entered === null) return;
    const trimmed = entered.trim();
    persistToken(trimmed);
    if (!trimmed) {
      updateStatus('token-missing', 'Token cleared. Publishing disabled until a token is set.');
      return;
    }
    updateStatus(dirty ? 'dirty' : 'idle', dirty ? 'Token updated. Pending publish will run shortly.' : 'Token updated.');
    if (dirty) publishIndexMap({ mode: 'manual' });
  }

  if (!open) return null;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'900px',maxWidth:'95%',maxHeight:'90%',overflow:'auto',background:'#0f1112',border:'1px solid rgba(255,255,255,0.04)',padding:16,borderRadius:8,color:'#dfeeea'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12,gap:12}}>
          <h3 style={{margin:0}}>Index Manager</h3>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
            <div>
              <button onClick={exportIndexMap} title="Export index map">Export</button>
              <button onClick={importIndexMap} title="Import index map" style={{marginLeft:8}}>Import</button>
              <button onClick={handleSetToken} title="Set or update the publish token" style={{marginLeft:8}}>Set token</button>
              <button onClick={() => publishIndexMap({ mode: 'manual' })} title="Publish index map to backend" style={{marginLeft:8}}>Publish</button>
              <button onClick={onClose} style={{marginLeft:8}}>Close</button>
            </div>
            {publishStatus?.message && (
              <div style={{fontSize:12,color:statusColor}}>{publishStatus.message}</div>
            )}
            <div style={{fontSize:11,color:'#7a9791'}}>
              Token: {tokenPreview}{token ? ` (${token.length} chars)` : ''}{lastPublishedText ? ` • Last publish ${lastPublishedText}` : ''}
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:12}}>
          <div style={{width:220,borderRight:'1px solid rgba(255,255,255,0.03)',paddingRight:12}}>
            {indices.map(ix => (
              <div key={ix} style={{marginBottom:6}}>
                <button
                  onClick={() => setActiveIndex(ix)}
                  style={{width:'100%',textAlign:'left',Padding:'8px 10px',background: activeIndex === ix ? '#17201f' : 'transparent',border:'none',color:'#dfeeea',cursor:'pointer'}}
                >{ix}</button>
              </div>
            ))}
          </div>

          <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{fontWeight:600}}>{activeIndex}</div>
              <div style={{color:'#9fb8b0'}}>{(members || []).length} members</div>
              <div style={{marginLeft:'auto'}}>
                <button onClick={() => { const text = prompt('Paste comma separated symbols to replace members for ' + activeIndex, (members||[]).join(',')); if (text != null) saveForIndex(activeIndex, text.split(',').map(s=>s.trim()).filter(Boolean)); }}>Replace...</button>
              </div>
            </div>

            <div style={{display:'flex',gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,marginBottom:6}}>Members</div>
                <div style={{maxHeight:260,overflow:'auto',border:'1px solid rgba(255,255,255,0.03)',padding:8,borderRadius:6}}>
                  {(members && members.length) ? members.map(m => (
                    <div key={m} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px',borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                      <div>{m}</div>
                      <div>
                        <button onClick={() => removeSymbol(m)} style={{marginLeft:6}}>Remove</button>
                      </div>
                    </div>
                  )) : (<div style={{color:'#9fb8b0'}}>No members yet</div>)}
                </div>
              </div>

              <div style={{width:360}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input placeholder="Search available symbols" value={search} onChange={(e) => setSearch(e.target.value)} style={{flex:1,padding:8,borderRadius:6,border:'1px solid rgba(255,255,255,0.04)',background:'#081010',color:'#dfeeea'}} />
                  <button onClick={() => { setSearch(''); setSelected(new Set()); }}>Clear</button>
                </div>

                <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                  <div style={{fontSize:13}}>Available</div>
                  <div style={{marginLeft:'auto'}}>
                    <button onClick={addSelectedBulk} disabled={selected.size === 0}>Add selected ({selected.size})</button>
                  </div>
                </div>

                <div style={{maxHeight:300,overflow:'auto',border:'1px solid rgba(255,255,255,0.03)',padding:8,borderRadius:6,marginTop:8}}>
                  {available.map(c => {
                    const s = normalizeIndexSymbol(c.symbol || c.id || '');
                    const checked = selected.has(s);
                    return (
                      <div key={s} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px',borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                        <label style={{flex:1,display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const n = new Set(selected);
                            if (n.has(s)) n.delete(s); else n.add(s);
                            setSelected(n);
                          }} />
                          <div style={{minWidth:80}}>{s}</div>
                          <div style={{color:'#9fb8b0'}}>{c.name}</div>
                        </label>
                        <div>
                          <button onClick={() => addSymbol(s)}>Add</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
