import React, { useState, useRef, useEffect } from 'react';

export default function FilterButton({
  selectedFilter,
  savedFilters,
  onSelectFilter,
  onCreateNew,
  onDeleteFilter,
  builtInFilters = [],
  onSelectBuiltIn
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={anchorRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          padding: '8px 16px',
          background: selectedFilter ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${selectedFilter ? 'rgba(61, 220, 132, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '8px',
          color: '#eaeaea',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = selectedFilter 
            ? 'rgba(61, 220, 132, 0.2)' 
            : 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = selectedFilter 
            ? 'rgba(61, 220, 132, 0.15)' 
            : 'rgba(255, 255, 255, 0.05)';
        }}
      >
        <span>🔍 {selectedFilter ? selectedFilter.name : 'Filters'}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: '#1a2332',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '200px',
            maxWidth: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            zIndex: 1000
          }}
        >
          {/* Create New Filter Button */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onCreateNew();
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(61, 220, 132, 0.1)',
              border: '1px solid rgba(61, 220, 132, 0.3)',
              borderRadius: '6px',
              color: '#7ff0a0',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
              fontWeight: 600
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(61, 220, 132, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(61, 220, 132, 0.1)';
            }}
          >
            <span style={{ fontSize: '16px' }}>+</span>
            <span>Create New Filter</span>
          </button>

          {/* Divider */}
          {savedFilters.length > 0 && (
            <div style={{ 
              height: '1px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              margin: '4px 0' 
            }} />
          )}

          {/* Saved Filters List */}
          {savedFilters.length === 0 ? (
            <div style={{ 
              padding: '12px', 
              color: '#9fb8b0', 
              fontSize: '13px', 
              textAlign: 'center' 
            }}>
              No saved filters
            </div>
          ) : (
            savedFilters.map((filter) => (
              <div
                key={filter.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelectFilter(filter);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: selectedFilter?.id === filter.id 
                      ? 'rgba(61, 220, 132, 0.2)' 
                      : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: selectedFilter?.id === filter.id ? '#7ff0a0' : '#eaeaea',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedFilter?.id !== filter.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedFilter?.id !== filter.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {filter.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete filter "${filter.name}"?`)) {
                      onDeleteFilter(filter.id);
                    }
                  }}
                  style={{
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ff9b9b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 155, 155, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title="Delete filter"
                >
                  ✕
                </button>
              </div>
            ))
          )}

          {/* Clear Filter Option */}
          {selectedFilter && (
            <>
              <div style={{ 
                height: '1px', 
                background: 'rgba(255, 255, 255, 0.1)', 
                margin: '4px 0' 
              }} />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSelectFilter(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#9fb8b0',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Clear Filter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

