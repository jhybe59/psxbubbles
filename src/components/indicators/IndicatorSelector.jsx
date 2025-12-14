import React, { useState, useMemo } from 'react';
import { getIndicatorsByCategory, createIndicatorInstance, CATEGORIES } from '../../lib/indicators';

/**
 * Indicator Selector Popup
 * Shows available indicators grouped by category with search
 */
export default function IndicatorSelector({ isOpen, onClose, onAddIndicator }) {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState(null);

    const indicatorsByCategory = useMemo(() => getIndicatorsByCategory(), []);

    const filteredIndicators = useMemo(() => {
        if (!search.trim()) return indicatorsByCategory;

        const term = search.toLowerCase();
        const filtered = {};

        for (const [cat, indicators] of Object.entries(indicatorsByCategory)) {
            const matches = indicators.filter(ind =>
                ind.name.toLowerCase().includes(term) ||
                ind.shortName.toLowerCase().includes(term)
            );
            if (matches.length > 0) {
                filtered[cat] = matches;
            }
        }
        return filtered;
    }, [search, indicatorsByCategory]);

    const handleAddIndicator = (indicator) => {
        const instance = createIndicatorInstance(indicator.id);
        if (instance) {
            onAddIndicator(instance);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            onClick={onClose}
        >
            {/* Backdrop */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(2px)'
            }} />

            {/* Modal */}
            <div
                style={{
                    position: 'relative',
                    width: '420px',
                    maxHeight: '70vh',
                    background: '#1e293b',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '16px', fontWeight: 600 }}>
                        📊 Add Indicator
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '20px',
                            cursor: 'pointer',
                            padding: '4px',
                            lineHeight: 1
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #334155' }}>
                    <input
                        type="text"
                        placeholder="Search indicators..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            color: '#f1f5f9',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                        autoFocus
                    />
                </div>

                {/* Category Tabs */}
                <div style={{
                    padding: '8px 20px',
                    display: 'flex',
                    gap: '6px',
                    borderBottom: '1px solid #334155',
                    overflowX: 'auto',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none',  // IE/Edge
                }}>
                    <style>{`
                    .tabs-container::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                    <div className="tabs-container" style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => setActiveCategory(null)}
                            style={{
                                padding: '6px 12px',
                                background: activeCategory === null ? '#2962FF' : 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: activeCategory === null ? '#fff' : '#94a3b8',
                                fontSize: '12px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            All
                        </button>
                        {Object.values(CATEGORIES).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                style={{
                                    padding: '6px 12px',
                                    background: activeCategory === cat ? '#2962FF' : 'transparent',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: activeCategory === cat ? '#fff' : '#94a3b8',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Indicator List */}
                <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <style>
                        {`
                            .indicator-list::-webkit-scrollbar {
                                width: 6px;
                            }
                            .indicator-list::-webkit-scrollbar-track {
                                background: #1e293b;
                            }
                            .indicator-list::-webkit-scrollbar-thumb {
                                background-color: #475569;
                                border-radius: 3px;
                            }
                        `}
                    </style>
                    <div className="indicator-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                        {Object.entries(filteredIndicators)
                            .filter(([cat]) => !activeCategory || cat === activeCategory)
                            .map(([category, indicators]) => (
                                <div key={category} style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        marginBottom: '8px'
                                    }}>
                                        {category}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {indicators.map(ind => (
                                            <button
                                                key={ind.id}
                                                onClick={() => handleAddIndicator(ind)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '10px 12px',
                                                    background: '#0f172a',
                                                    border: '1px solid transparent',
                                                    borderRadius: '6px',
                                                    color: '#e2e8f0',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.1s ease'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = '#334155';
                                                    e.currentTarget.style.borderColor = '#475569';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = '#0f172a';
                                                    e.currentTarget.style.borderColor = 'transparent';
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{ind.name}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                        {ind.shortName} • {ind.type === 'overlay' ? 'Overlay' : 'Oscillator'}
                                                    </div>
                                                </div>
                                                <span style={{ color: '#2962FF', fontSize: '18px' }}>+</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                        {Object.keys(filteredIndicators).length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                color: '#64748b',
                                padding: '40px 20px',
                                fontSize: '14px'
                            }}>
                                No indicators found for "{search}"
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
