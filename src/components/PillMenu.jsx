import React, { useEffect, useRef } from 'react';

export default function PillMenu({ anchorRect, onClose, currentInterval, setCurrentInterval, selections, setSelections, avgFavPctForInterval, pctToColor, onOpenSymbols }) {
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
    style.left = Math.max(8, anchorRect.left + anchorRect.width / 2 - 160) + 'px';
    style.top = (anchorRect.top + anchorRect.height + 8) + 'px';
    style.width = '320px';
  } else {
    style.right = '12px';
    style.top = '64px';
    style.width = '320px';
  }

  // Trimmed/streamlined option lists
  const sizes = ['Performance', 'Market Cap', 'Volume', 'Volatility', 'Relative Volume'];
  const contents = ['Performance', 'Price', 'Price Change', 'Volume', 'Volatility', 'Relative Volume'];

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
        <div className="pill-menu-title">Bubble Settings</div>
        <button className="pill-menu-close" onClick={onClose} aria-label="Close">✕</button>
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

      <div className="pill-menu-subtitle">Bubble content <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>(max 3)</span></div>
      <div className="pill-menu-section">
        {contents.map((c) => {
          // Normalize selections.content to array
          const contentArray = Array.isArray(selections.content)
            ? selections.content
            : [selections.content || 'Performance'];

          const selectionIndex = contentArray.indexOf(c);
          const isActive = selectionIndex !== -1;
          const isFull = contentArray.length >= 3;
          const isDisabled = !isActive && isFull;

          // Order badge: ①②③
          const orderBadges = ['①', '②', '③'];
          const orderBadge = isActive && selectionIndex < 3 ? orderBadges[selectionIndex] : '';

          const handleClick = () => {
            if (isActive) {
              // Remove from selection (but keep at least 1)
              if (contentArray.length > 1) {
                const newContent = contentArray.filter(item => item !== c);
                setSelections({ ...selections, content: newContent });
              }
              // If only 1 item, don't allow removal (keep it selected)
            } else if (!isFull) {
              // Add to selection
              const newContent = [...contentArray, c];
              setSelections({ ...selections, content: newContent });
            }
          };

          return (
            <button
              key={c}
              className={`pill-menu-pill ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={handleClick}
              aria-pressed={isActive}
              tabIndex={isDisabled ? -1 : 0}
              style={{
                opacity: isDisabled ? 0.4 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                position: 'relative'
              }}
            >
              {orderBadge && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  fontSize: '12px',
                  color: '#4ade80',
                  fontWeight: 700,
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}>{orderBadge}</span>
              )}
              {c}
            </button>
          )
        })}
      </div>

      {/* App Settings Section */}
      <div className="pill-menu-subtitle" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '20px' }}>App Settings</div>
      <div className="pill-menu-section">
        <button
          className="pill-menu-pill pill-menu-action-btn"
          onClick={() => {
            if (onOpenSymbols) {
              onOpenSymbols();
            }
            onClose();
          }}
          tabIndex={0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'center'
          }}
        >
          <span>☰</span>
          <span>Symbols Panel</span>
        </button>
      </div>
    </div>
  );
}
