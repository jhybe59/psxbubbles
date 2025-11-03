import React, { useEffect, useRef } from 'react';

export default function PillMenu({ anchorRect, onClose, currentInterval, setCurrentInterval, selections, setSelections, avgFavPctForInterval, pctToColor }) {
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

  // Trimmed/streamlined option lists to remove extra/rarely-used items
  const periods = ['1 Min','5 Min','15 Min','Hour','4 Hours','Day','Week','Month','3 Months','Year'];
  const sizes = ['Performance','Market Cap','Volume'];
  const contents = ['Performance','Price','Price Change','Volume'];
  const colors = ['Performance','Neutral'];

  // Keyboard navigation: handle arrow navigation between pills and Enter/Space to activate
  useEffect(() => {
    function onKey(e) {
      if (!rootRef.current) return;
      const pills = Array.from(rootRef.current.querySelectorAll('.pill-menu-pill'));
      if (!pills.length) return;

      const active = document.activeElement;
      const idx = pills.indexOf(active);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = pills[(idx + 1) % pills.length];
        next?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = pills[(idx - 1 + pills.length) % pills.length];
        prev?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        // activate focused pill
        if (active && active.classList && active.classList.contains('pill-menu-pill')) {
          (active).click && (active).click();
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
  <div ref={rootRef} className="pill-menu" style={style} role="dialog" aria-modal="false">
      <div className="pill-menu-header">
        <div className="pill-menu-title">Period</div>
        <button className="pill-menu-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="pill-menu-section">
        {periods.map((p) => {
          // compute color for this period independently so selecting one doesn't override others
          const pct = (typeof avgFavPctForInterval === 'function') ? avgFavPctForInterval(p) : 0;
          const bg = (typeof pctToColor === 'function') ? pctToColor(pct) : undefined;
          return (
            <button
              key={p}
              className={`pill-menu-pill ${p === currentInterval ? 'active' : ''}`}
              onClick={() => setCurrentInterval(p)}
              aria-pressed={p === currentInterval}
              tabIndex={0}
              style={bg ? { background: bg } : undefined}
              title={`${pct.toFixed(2)}% avg`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="pill-menu-subtitle">Bubble size</div>
      <div className="pill-menu-section">
        {sizes.map((s) => (
          <button
            key={s}
            className={`pill-menu-pill ${selections.size === s ? 'active' : ''}`}
            onClick={() => setSelections({ ...selections, size: s })}
            aria-pressed={selections.size === s}
            tabIndex={0}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="pill-menu-subtitle">Bubble content</div>
      <div className="pill-menu-section">
        {contents.map((c) => {
          // keep the pill's semantic value equal to its label so we can
          // distinguish 'Price' vs 'Price Change' in consumers
          const valueToSet = c
          const isActive = selections.content === valueToSet
          return (
            <button
              key={c}
              className={`pill-menu-pill ${isActive ? 'active' : ''}`}
              onClick={() => setSelections({ ...selections, content: valueToSet })}
              aria-pressed={isActive}
              tabIndex={0}
            >
              {c}
            </button>
          )
        })}
      </div>

      <div className="pill-menu-subtitle">Bubble color</div>
      <div className="pill-menu-section">
        {colors.map((c) => (
          <button
            key={c}
            className={`pill-menu-pill ${selections.color === c ? 'active' : ''}`}
            onClick={() => setSelections({ ...selections, color: c })}
            aria-pressed={selections.color === c}
            tabIndex={0}
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
