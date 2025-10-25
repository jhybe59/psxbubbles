import React, { useEffect, useState, useRef } from 'react';

export default function SearchPopover({ coins = [], anchorRect = null, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onPointer(e) {
      try {
        const node = ref.current;
        // if click is inside popover, ignore
        if (node && node.contains(e.target)) return;
        // if click is on the header search icon, ignore (we want that to toggle/open)
        if (e.target && e.target.closest && e.target.closest('.search-icon')) return;
        // otherwise close
        onClose();
      } catch (err) {
        // ignore
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  useEffect(() => {
    // focus input when open
    const el = ref.current && ref.current.querySelector('input');
    if (el) el.focus();
  }, []);

  const style = { position: 'absolute', zIndex: 2000 };
  if (anchorRect) {
    style.left = Math.max(8, anchorRect.left + anchorRect.width / 2 - 200) + 'px';
    style.top = (anchorRect.top + anchorRect.height + 8) + 'px';
    style.width = '360px';
  } else {
    style.right = '12px';
    style.top = '64px';
    style.width = '360px';
  }

  const ql = q.trim().toLowerCase();
  const results = coins.filter(c => {
    if (!ql) return true;
    return (c.name && c.name.toLowerCase().includes(ql)) || (c.symbol && c.symbol.toLowerCase().includes(ql));
  }).slice(0, 12);

  return (
    <div className="search-popover" style={style} ref={ref} role="dialog" aria-modal="false">
      <div className="search-input-row">
        <span className="search-icon-inline">🔍</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cryptocurrency" />
        <button className="search-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="search-list">
        {results.map((c, i) => (
          <div key={c.id || c.symbol || i} className="search-row" onClick={() => { onSelect(c); onClose(); }}>
            <div className="search-rank">{i+1}</div>
            <div className="search-name">
              <div className="search-title">{c.name}</div>
              <div className="search-sub">{c.symbol ? c.symbol.toUpperCase() : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
