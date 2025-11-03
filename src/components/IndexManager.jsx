import React, { useState, useMemo, useEffect } from 'react'

export default function IndexManager({ open, onClose, coins = [], indexMap = {}, setIndexMap }) {
  const indices = ['KSE 100','KSE 30','ALLSHR','KMI 30','KMIALLSHR'];
  const [activeIndex, setActiveIndex] = useState(indices[0]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    setActiveIndex(indices[0]);
    setSearch('');
    setSelected(new Set());
  }, [open]);

  // Export current indexMap to a downloadable JSON file
  function exportIndexMap() {
    try {
      const data = JSON.stringify(indexMap || {}, null, 2);
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
      try { localStorage.setItem('indexMap', JSON.stringify(parsed)); } catch (e) { /* ignore */ }
      setIndexMap(parsed);
      alert('Index map imported');
    } catch (e) {
      alert('Failed to import index map: ' + (e && e.message ? e.message : e));
    }
  }

  // Publish index map to server endpoint. Prompts for a token and posts
  // the current indexMap to /api/index_map. This requires the server
  // admin process to be running and ADMIN_SECRET (or INDEX_API_TOKEN)
  // set to the same token.
  async function publishIndexMap() {
    try {
      const token = prompt('Enter publish token (admin secret)');
      if (!token) return;
      const res = await fetch('/api/index_map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(indexMap || {})
      });
      const json = await res.json();
      if (!res.ok) return alert('Publish failed: ' + (json && json.error ? json.error : res.statusText));
      alert('Index map published to server');
    } catch (e) {
      alert('Publish error: ' + (e && e.message ? e.message : e));
    }
  }

  const members = (indexMap && indexMap[activeIndex]) ? indexMap[activeIndex] : [];

  const available = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return coins
      .filter(c => !members.map(m => m.toLowerCase()).includes((c.symbol || c.id || '').toLowerCase()))
      .filter(c => !q || (c.symbol || c.id || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q))
      .slice(0, 300);
  }, [coins, members, search]);

  function saveForIndex(ix, arr) {
    const next = Object.assign({}, indexMap, { [ix]: arr });
    setIndexMap(next);
    try { localStorage.setItem('indexMap', JSON.stringify(next)); } catch (e) { /* ignore */ }
  }

  function addSymbol(sym) {
    const arr = Array.from(new Set([...(members || []), sym]));
    saveForIndex(activeIndex, arr);
  }

  function removeSymbol(sym) {
    const arr = (members || []).filter(s => s.toLowerCase() !== (sym || '').toLowerCase());
    saveForIndex(activeIndex, arr);
  }

  function addSelectedBulk() {
    const arr = Array.from(new Set([...(members || []), ...Array.from(selected)]));
    saveForIndex(activeIndex, arr);
    setSelected(new Set());
  }

  if (!open) return null;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'900px',maxWidth:'95%',maxHeight:'90%',overflow:'auto',background:'#0f1112',border:'1px solid rgba(255,255,255,0.04)',padding:16,borderRadius:8,color:'#dfeeea'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <h3 style={{margin:0}}>Index Manager</h3>
          <div>
            <button onClick={exportIndexMap} title="Export index map">Export</button>
            <button onClick={importIndexMap} title="Import index map" style={{marginLeft:8}}>Import</button>
            <button onClick={publishIndexMap} title="Publish index map" style={{marginLeft:8}}>Publish</button>
            <button onClick={onClose} style={{marginLeft:8}}>Close</button>
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
                    const s = (c.symbol || c.id || '').toUpperCase();
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
