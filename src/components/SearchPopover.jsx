import React, { useEffect, useState, useRef } from 'react';

export default function SearchPopover({ coins = [], anchorRect = null, initialQuery = '', onSelect, onClose }) {
  const [q, setQ] = useState(initialQuery);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Arrow key navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = ref.current?.querySelectorAll('.search-row');
        if (!items || items.length === 0) return;
        const currentIndex = Array.from(items).findIndex(item => item === document.activeElement);
        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }
        if (items[nextIndex]) {
          items[nextIndex].focus();
        }
      }
      // Enter key to select
      if (e.key === 'Enter' && document.activeElement.classList.contains('search-row')) {
        document.activeElement.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Update query when initialQuery changes (when opened via typing)
  useEffect(() => {
    if (initialQuery) {
      setQ(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    // Focus input when modal opens
    if (inputRef.current) {
      inputRef.current.focus();
      // If there's an initial query, move cursor to end
      if (initialQuery && inputRef.current.value) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [initialQuery]);

  // Filter results
  const ql = q.trim().toLowerCase();
  const results = coins.filter(c => {
    if (!ql) return true;
    const name = (c.name || '').toLowerCase();
    const symbol = (c.symbol || '').toLowerCase();
    return name.includes(ql) || symbol.includes(ql);
  }).slice(0, 20); // Show more results in modal

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="search-modal-backdrop" 
        onClick={handleBackdropClick}
        role="presentation"
      />
      
      {/* Centered Modal */}
      <div className="search-modal-container" ref={ref} role="dialog" aria-modal="true" aria-label="Symbol Search">
        <div className="search-modal-content">
          {/* Header */}
          <div className="search-modal-header">
            <h2 className="search-modal-title">Symbol Search</h2>
            <button 
              className="search-modal-close" 
              onClick={onClose} 
              aria-label="Close search"
              type="button"
            >
              ✕
            </button>
          </div>

          {/* Search Input */}
          <div className="search-input-row">
            <span className="search-icon-inline">🔍</span>
            <input 
              ref={inputRef}
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search symbol or name"
              type="text"
              autoComplete="off"
            />
          </div>

          {/* Filter Tabs (Optional - like TradingView) */}
          <div className="search-filter-tabs">
            <button className="search-tab active" type="button">All</button>
            <button className="search-tab" type="button">Stocks</button>
            <button className="search-tab" type="button">Indices</button>
          </div>

          {/* Results List */}
          <div className="search-list">
            {results.length === 0 && ql ? (
              <div className="search-empty">No results found for "{q}"</div>
            ) : results.length === 0 ? (
              <div className="search-empty">Start typing to search...</div>
            ) : (
              results.map((c, i) => {
                // Get logo from metadata or coin data
                const logoUrl = c.image || (c.symbol ? `/assets/logos/${c.symbol.toUpperCase()}.svg` : null);
                const displayName = c.displayName || c.name || c.symbol;
                
                return (
                  <div 
                    key={c.id || c.symbol || i} 
                    className="search-row" 
                    onClick={() => { onSelect(c); onClose(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(c);
                        onClose();
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Select ${displayName}`}
                  >
                    <div className="search-row-content">
                      {logoUrl ? (
                        <div className="search-logo-wrapper">
                          <img 
                            src={logoUrl} 
                            alt="" 
                            className="search-row-logo"
                            onError={(e) => { 
                              // Hide image on error and show placeholder
                              e.target.style.display = 'none';
                              const placeholder = e.target.nextSibling;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                          <div className="search-logo-placeholder" style={{ display: 'none' }}>
                            {(c.symbol || '').slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                      ) : (
                        <div className="search-logo-placeholder">
                          {(c.symbol || '').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="search-name">
                        <div className="search-title">{displayName}</div>
                        <div className="search-sub">
                          {c.symbol ? c.symbol.toUpperCase() : ''}
                          {c.exchange && ` • ${c.exchange}`}
                        </div>
                      </div>
                    </div>
                    {c.price && (
                      <div className="search-price">
                        {typeof c.price === 'number' ? c.price.toFixed(2) : c.price}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="search-modal-footer">
            <span className="search-hint">Search using symbol or company name</span>
          </div>
        </div>
      </div>
    </>
  );
}
