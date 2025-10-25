import React, { useEffect, useRef } from 'react';

export default function PillMenu({ anchorRect, onClose, currentInterval, setCurrentInterval, selections, setSelections }) {
  // anchorRect: {left, top, width, height} in page coordinates - we position menu near it
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rootRef = useRef(null);
  // click-away: close the menu when clicking anywhere outside the menu
  useEffect(() => {
    function onPointerDown(e) {
      try {
        if (!rootRef.current) return;
        if (!rootRef.current.contains(e.target)) onClose();
      } catch (err) {
        // ignore
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  const style = { position: 'absolute', zIndex: 2000 };
  if (anchorRect) {
    // place menu slightly below and centered on the pill
    style.left = Math.max(8, anchorRect.left + anchorRect.width / 2 - 200) + 'px';
    style.top = (anchorRect.top + anchorRect.height + 8) + 'px';
    style.width = '380px';
  } else {
    style.right = '12px';
    style.top = '64px';
    style.width = '380px';
  }

  const periods = ['1 Min','5 Min','15 Min','Hour','4 Hours','Day','Week','Month','3 Months','Year'];
  const sizes = ['Performance','Rank ⇅','Market Cap','24h Volume'];
  const contents = ['Performance','Rank ⇅','Market Cap','24h Volume','Price','Rank','Name','Dominance'];
  const colors = ['Performance','Rank ⇅','Neutral'];

  return (
  <div ref={rootRef} className="pill-menu" style={style} role="dialog" aria-modal="false">
      <div className="pill-menu-header">
        <div className="pill-menu-title">Period</div>
        <button className="pill-menu-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="pill-menu-section">
        {periods.map((p) => (
          <button
            key={p}
            className={`pill-menu-pill ${p === currentInterval ? 'active' : ''}`}
            onClick={() => {
              setCurrentInterval(p);
              // close after selection
              onClose();
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="pill-menu-subtitle">Bubble size</div>
      <div className="pill-menu-section">
        {sizes.map((s) => (
          <button
            key={s}
            className={`pill-menu-pill ${selections.size === s ? 'active' : ''}`}
            onClick={() => {
              setSelections({ ...selections, size: s });
              onClose();
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="pill-menu-subtitle">Bubble content</div>
      <div className="pill-menu-section">
        {contents.map((c) => (
          <button
            key={c}
            className={`pill-menu-pill ${selections.content === c ? 'active' : ''}`}
            onClick={() => {
              setSelections({ ...selections, content: c });
              onClose();
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="pill-menu-subtitle">Bubble color</div>
      <div className="pill-menu-section">
        {colors.map((c) => (
          <button
            key={c}
            className={`pill-menu-pill ${selections.color === c ? 'active' : ''}`}
            onClick={() => {
              setSelections({ ...selections, color: c });
              onClose();
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="pill-menu-actions">
        <button className="pill-menu-apply" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
