import React, { useState, useEffect } from 'react';

export default function BackupPanel({ open, onClose }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const baseUrl = 'http://localhost:4001';

  useEffect(() => {
    if (!open) return;
    fetchList();
  }, [open]);

  async function fetchList() {
    try {
      setLoading(true);
  const res = await fetch(`${baseUrl}/api/backups`);
      const json = await res.json();
      setBackups(json.backups || []);
    } catch (err) { setMessage('Failed to fetch backups'); }
    finally { setLoading(false); }
  }

  async function doBackup() {
    try {
      setLoading(true);
      setMessage('Creating backup...');
  const res = await fetch(`${baseUrl}/api/backup`, { method: 'POST' });
      const j = await res.json();
      if (j.ok) { setMessage(`Backup created: ${j.file}`); fetchList(); }
      else setMessage('Backup failed: ' + (j.error || 'unknown'));
    } catch (err) { setMessage('Backup failed'); }
    finally { setLoading(false); }
  }

  async function doRestore(name) {
    if (!confirm(`Restore backup ${name}? This will overwrite files in the repo.`)) return;
    try {
      setLoading(true);
      setMessage('Restoring... (server will create a pre-restore snapshot)');
  const res = await fetch(`${baseUrl}/api/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: name }) });
      const j = await res.json();
      if (j.ok) { setMessage(`Restored ${j.restored} (safety: ${j.safety})`); }
      else setMessage('Restore failed: ' + (j.error || 'unknown'));
    } catch (err) { setMessage('Restore failed'); }
    finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1400,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:700,maxWidth:'95%',maxHeight:'85%',overflow:'auto',background:'#0f1112',padding:16,borderRadius:8,color:'#dfeeea'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 style={{margin:0}}>Backup & Restore</h3>
          <div><button onClick={onClose}>Close</button></div>
        </div>

        <div style={{marginTop:12}}>
          <button onClick={doBackup} disabled={loading} style={{marginRight:8}}>Create Backup</button>
          <button onClick={fetchList} disabled={loading}>Refresh List</button>
        </div>

        <div style={{marginTop:12}}>
          {message && <div style={{marginBottom:8,color:'#9fb8b0'}}>{message}</div>}
          <div style={{maxHeight:320,overflow:'auto',border:'1px solid rgba(255,255,255,0.04)',padding:8,borderRadius:6}}>
            {loading && <div>Loading...</div>}
            {!loading && (!backups || backups.length === 0) && <div style={{color:'#9fb8b0'}}>No backups found</div>}
            {!loading && backups.map((b) => (
              <div key={b} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px',borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                <div style={{flex:1}}>{b}</div>
                <div>
                  <button onClick={async () => {
                    try {
                      const res = await fetch(`${baseUrl}/api/backups/${encodeURIComponent(b)}`);
                      if (!res.ok) { setMessage('Download failed'); return; }
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = b; document.body.appendChild(a); a.click(); a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err) { setMessage('Download failed'); }
                  }} style={{marginRight:8}}>Download</button>
                  <button onClick={() => doRestore(b)}>Restore</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
