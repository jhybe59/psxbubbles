import React, { useState, useMemo } from 'react';
import { getAllMetadata, useSymbolMetadata, importMetadata, clearAllMetadata, setMetadata, removeMetadata } from '../hooks/useSymbolMetadata';
import './SymbolsPanel.css';

export default function SymbolsPanel({ symbols = [], open = true, onClose = () => {} }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // symbol being edited
  const [allMeta, setAllMeta] = useState(() => getAllMetadata());
  const [dragOverSym, setDragOverSym] = useState(null);

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
    setEditing({
      symbol: sym.symbol || sym.id || sym,
      displayName: (allMeta[sym.symbol]?.displayName) || sym.name || '',
      shortName: (allMeta[sym.symbol]?.shortName) || (sym.symbol || '').slice(0, 6),
      image: (allMeta[sym.symbol]?.image) || '',
      splitFactor: (allMeta[sym.symbol]?.splitFactor) || ''
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
        const prev = cur[symKey] || {};
        const img = reader.result;
        // merge and save image only (preserve existing meta)
        setMetadata(symKey, Object.assign({}, prev, { image: img }));
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
        const prev = cur[symKey] || {};
        const img = reader.result;
        setMetadata(symKey, Object.assign({}, prev, { image: img }));
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
      const prev = cur[symKey] || {};
      // mark as hidden
      setMetadata(symKey, Object.assign({}, prev, { hidden: true }));
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
      const prev = cur[symKey] || {};
      const next = Object.assign({}, prev);
      if (next.hidden) delete next.hidden;
      setMetadata(symKey, next);
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

  if (!open) return null;

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

        <div className="sp-search">
          <input placeholder="Search symbol or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="sp-body">
          <div className="sp-list">
            {list.map((s) => (
              <div key={s.symbol || s.id} className="sp-row">
                <div className="sp-row-left">
                  <label
                    className={`sp-thumb ${dragOverSym === (s.symbol || s.id || '') ? 'drag-over' : ''}`}
                    htmlFor={`logo-${(s.symbol || s.id || '')}`}
                    onDragEnter={(e) => onThumbDragEnter(e, (s.symbol || s.id || ''))}
                    onDragOver={onThumbDragOver}
                    onDragLeave={onThumbDragLeave}
                    onDrop={(e) => onThumbDrop(e, (s.symbol || s.id || ''))}
                  >
                    <input id={`logo-${(s.symbol || s.id || '')}`} className="sp-file-input" type="file" accept="image/*" onChange={(e) => onRowLogoChange(e, (s.symbol || s.id || ''))} />
                    {allMeta[s.symbol]?.image ? <img src={allMeta[s.symbol].image} alt="logo" /> : <div className="sp-placeholder">{(s.symbol || '').slice(0,3)}</div>}
                  </label>
                  <div>
                    <div className="sp-name">{allMeta[s.symbol]?.displayName || s.name || s.symbol}</div>
                    <div className="sp-symbol">{(s.symbol || s.id || '').toUpperCase()}</div>
                  </div>
                </div>
                <div className="sp-row-right">
                  <button onClick={() => openEditor(s)}>Edit</button>
                  <button className="sp-delete" onClick={() => deleteMetadata((s.symbol || s.id || ''))} title="Hide symbol from display">✖</button>
                </div>
              </div>
            ))}
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
                  {allMeta[editing.symbol]?.hidden ? (
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
