import React, { useState, useMemo } from 'react';
import { getAllMetadata, importMetadata, clearAllMetadata, setMetadata, removeMetadata, normalizeSymbolKey } from '../hooks/useSymbolMetadata';
import './SymbolsPanel.css';

export default function SymbolsPanel({ symbols = [], open = true, onClose = () => {} }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // symbol being edited
  const [allMeta, setAllMeta] = useState(() => getAllMetadata());
  const [dragOverSym, setDragOverSym] = useState(null);
  const diagnostics = useMemo(() => {
    const symbolKeys = new Set((symbols || []).map((s) => normalizeSymbolKey(s.symbol || s.id || '')));
    const metadataKeys = new Set(Object.keys(allMeta || {}).map((k) => normalizeSymbolKey(k)));
    const missing = [];
    symbolKeys.forEach((key) => {
      if (key && !metadataKeys.has(key)) missing.push(key);
    });
    const orphans = [];
    metadataKeys.forEach((key) => {
      if (key && !symbolKeys.has(key)) orphans.push(key);
    });
    missing.sort();
    orphans.sort();
    return { missing, orphans };
  }, [symbols, allMeta]);

  // simple filtered list
  const list = useMemo(() => {
    const q = (query || '').toLowerCase();
    if (!q) return symbols.slice(0, 500);
    return symbols.filter((s) => (s.symbol || s.id || '').toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q));
  }, [symbols, query]);

  // when metadata changes externally, refresh snapshot
  function refreshMeta() {
    setAllMeta(getAllMetadata());
  }

  function openEditor(sym) {
    const key = normalizeSymbolKey(sym.symbol || sym.id || sym);
    const meta = allMeta[key] || {};
    setEditing({
      symbol: key,
      displayName: meta.displayName || sym.name || '',
      shortName: meta.shortName || (sym.symbol || '').slice(0, 6),
      image: meta.image || '',
      splitFactor: meta.splitFactor || ''
    });
  }

  async function onLogoFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditing((ed) => ({ ...ed, image: reader.result }));
    };
    reader.readAsDataURL(f);
  }

  // per-row thumbnail upload handler: clicking the thumb opens file picker
  function onRowLogoChange(e, symKey) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cur = getAllMetadata() || {};
        const normalizedKey = normalizeSymbolKey(symKey);
        const prev = cur[normalizedKey] || {};
        const img = reader.result;
        // merge and save image only (preserve existing meta)
        setMetadata(normalizedKey, Object.assign({}, prev, { image: img }));
        refreshMeta();
      } catch (err) {
        // ignore
      }
    };
    reader.readAsDataURL(f);
  }

  // drag-and-drop handlers for thumbnails
  function onThumbDragEnter(e, symKey) {
    e.preventDefault();
    setDragOverSym(symKey);
  }

  function onThumbDragOver(e) {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
  }

  function onThumbDragLeave(e) {
    e.preventDefault();
    setDragOverSym(null);
  }

  function onThumbDrop(e, symKey) {
    e.preventDefault();
    setDragOverSym(null);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cur = getAllMetadata() || {};
        const normalizedKey = normalizeSymbolKey(symKey);
        const prev = cur[normalizedKey] || {};
        const img = reader.result;
        setMetadata(normalizedKey, Object.assign({}, prev, { image: img }));
        refreshMeta();
      } catch (err) {
        // ignore
      }
    };
    reader.readAsDataURL(f);
  }

  function saveEditing() {
    if (!editing || !editing.symbol) return;
    importMetadata({ [editing.symbol]: { displayName: editing.displayName, shortName: editing.shortName, image: editing.image, splitFactor: editing.splitFactor } });
    refreshMeta();
    setEditing(null);
  }

  function deleteMetadata(symKey) {
    if (!symKey) return;
    if (!confirm(`Hide ${symKey} from the app display? (The symbol will remain in the database but will not be shown.)`)) return;
    try {
      const cur = getAllMetadata() || {};
      const normalizedKey = normalizeSymbolKey(symKey);
      const prev = cur[normalizedKey] || {};
      // mark as hidden
      setMetadata(normalizedKey, Object.assign({}, prev, { hidden: true }));
    } catch (e) {
      // ignore
    }
    refreshMeta();
    // if editor is open for the same symbol, close it
    if (editing && editing.symbol === symKey) setEditing(null);
  }

  function unhideMetadata(symKey) {
    if (!symKey) return;
    try {
      const cur = getAllMetadata() || {};
      const normalizedKey = normalizeSymbolKey(symKey);
      const prev = cur[normalizedKey] || {};
      const next = Object.assign({}, prev);
      if (next.hidden) delete next.hidden;
      setMetadata(normalizedKey, next);
    } catch (e) {}
    refreshMeta();
  }

  function applySplit() {
    if (!editing || !editing.symbol) return;
    // store splitFactor; actual price adjustment must be done by data pipeline / consumer
    importMetadata({ [editing.symbol]: { splitFactor: editing.splitFactor } });
    refreshMeta();
    alert(`Stored split factor ${editing.splitFactor} for ${editing.symbol}. To apply this to prices, merge metadata in your data pipeline or chart.`);
  }

  function exportAll() {
    const all = getAllMetadata();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'symbol-metadata.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        importMetadata(obj);
        refreshMeta();
        alert('Imported metadata');
      } catch (err) {
        alert('Invalid file');
      }
    };
    reader.readAsText(f);
  }

  function clearAll() {
    if (!confirm('Clear all saved symbol metadata? This cannot be undone.')) return;
    clearAllMetadata();
    refreshMeta();
  }

  function addPlaceholdersForMissing() {
    if (!diagnostics.missing.length) return;
    const payload = diagnostics.missing.reduce((acc, key) => {
      if (!key) return acc;
      acc[key] = { displayName: key, shortName: key.slice(0, 6), image: '', splitFactor: '' };
      return acc;
    }, {});
    importMetadata(payload);
    refreshMeta();
    alert(`Added placeholder metadata for ${Object.keys(payload).length} symbols.`);
  }

  function removeOrphanMetadataEntries() {
    if (!diagnostics.orphans.length) return;
    if (!confirm(`Remove ${diagnostics.orphans.length} metadata entries that no longer match live symbols?`)) return;
    diagnostics.orphans.forEach((key) => removeMetadata(key));
    refreshMeta();
  }

  function exportDiagnostics() {
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'symbol-metadata-diagnostics.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;
  const editingMeta = editing && editing.symbol ? (allMeta[editing.symbol] || {}) : null;

  return (
    <div className="symbols-panel-backdrop" onClick={() => onClose()}>
      <div className="symbols-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sp-header">
          <h3>Symbols / Tickers Panel</h3>
          <div className="sp-actions">
            <button onClick={exportAll}>Export</button>
            <label className="file-btn">Import<input type="file" accept="application/json" onChange={importFile} /></label>
            <button onClick={clearAll}>Clear</button>
            <button onClick={() => onClose()}>Close</button>
          </div>
        </div>

        <div className="sp-diagnostics">
          <div>
            <strong>Diagnostics:</strong> {diagnostics.missing.length} missing, {diagnostics.orphans.length} orphaned
          </div>
          <div className="sp-diagnostics-actions">
            <button onClick={addPlaceholdersForMissing} disabled={!diagnostics.missing.length}>Add placeholders</button>
            <button onClick={removeOrphanMetadataEntries} disabled={!diagnostics.orphans.length}>Remove orphaned</button>
            <button onClick={exportDiagnostics}>Export report</button>
          </div>
        </div>

        <div className="sp-search">
          <input placeholder="Search symbol or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="sp-body">
          <div className="sp-list">
            {list.map((s) => {
              const key = normalizeSymbolKey(s.symbol || s.id || '');
              const meta = allMeta[key] || {};
              return (
                <div key={key || s.symbol || s.id} className="sp-row">
                  <div className="sp-row-left">
                    <label
                      className={`sp-thumb ${dragOverSym === key ? 'drag-over' : ''}`}
                      htmlFor={`logo-${key}`}
                      onDragEnter={(e) => onThumbDragEnter(e, key)}
                      onDragOver={onThumbDragOver}
                      onDragLeave={onThumbDragLeave}
                      onDrop={(e) => onThumbDrop(e, key)}
                    >
                      <input id={`logo-${key}`} className="sp-file-input" type="file" accept="image/*" onChange={(e) => onRowLogoChange(e, key)} />
                      {meta.image ? <img src={meta.image} alt="logo" /> : <div className="sp-placeholder">{key.slice(0,3) || (s.symbol || '').slice(0,3)}</div>}
                    </label>
                    <div>
                      <div className="sp-name">{meta.displayName || s.name || s.symbol}</div>
                      <div className="sp-symbol">{key}</div>
                    </div>
                  </div>
                  <div className="sp-row-right">
                    <button onClick={() => openEditor(s)}>Edit</button>
                    <button className="sp-delete" onClick={() => deleteMetadata(key)} title="Hide symbol from display">✖</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sp-editor">
            {editing ? (
              <div>
                <h4>Editing {editing.symbol}</h4>
                <div className="field"><label>Display name</label><input value={editing.displayName} onChange={(e) => setEditing((ed) => ({ ...ed, displayName: e.target.value }))} /></div>
                <div className="field"><label>Short name</label><input value={editing.shortName} onChange={(e) => setEditing((ed) => ({ ...ed, shortName: e.target.value }))} /></div>
                <div className="field"><label>Split factor (e.g. 2 for 2-for-1)</label><input value={editing.splitFactor} onChange={(e) => setEditing((ed) => ({ ...ed, splitFactor: e.target.value }))} /></div>
                <div className="field"><label>Logo</label>
                  <input type="file" accept="image/*" onChange={onLogoFileChange} />
                  {editing.image && <div className="preview"><img src={editing.image} alt="preview" /></div>}
                </div>
                <div className="editor-actions">
                  <button onClick={saveEditing}>Save</button>
                  <button onClick={applySplit}>Store Split</button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                  {editingMeta?.hidden ? (
                    <button className="sp-delete" onClick={() => unhideMetadata(editing.symbol)}>Unhide</button>
                  ) : (
                    <button className="sp-delete" onClick={() => deleteMetadata(editing.symbol)}>Hide</button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{padding:12,color:'#9fb8b0'}}>Select a symbol to edit its metadata (display name, short name, logo, split factor).</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
