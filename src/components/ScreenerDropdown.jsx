import React, { useState, useRef, useEffect } from 'react';
import './ScreenerDropdown.css';
import StrategyEditor from './StrategyEditor';
import AdvancedStrategyBuilder from './AdvancedStrategyBuilder';

const QUICK_FILTERS = [
    {
        id: 'gainers',
        label: '🚀 Top Gainers',
        conditions: {
            changePct: { min: 5 }
        }
    },
    {
        id: 'losers',
        label: '🩸 Top Losers',
        conditions: {
            changePct: { max: -5 }
        }
    },
    {
        id: 'vol_spike',
        label: '🔊 Volume Spikes',
        conditions: {
            volume: { operator: 'above', target: 'avg_volume', multiplier: 2 }
        }
    },
    {
        id: 'oversold',
        label: '📉 Oversold (RSI)',
        conditions: {
            rsi: { max: 30 }
        }
    },
    {
        id: 'overbought',
        label: '📈 Overbought (RSI)',
        conditions: {
            rsi: { min: 70 }
        }
    },
    {
        id: 'new_ath',
        label: '🏆 Near ATH',
        conditions: {
            price: { operator: 'above', target: 'high', interval: '1y', multiplier: 0.95 }
        }
    }
];

export default function ScreenerDropdown({ activeFilters, onFilterChange, resultCount, totalCount }) {
    const [isOpen, setIsOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [filterToEdit, setFilterToEdit] = useState(null);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleFilter = (filter) => {
        const isActive = activeFilters.some(f => f.id === filter.id);
        let newFilters;
        if (isActive) {
            newFilters = activeFilters.filter(f => f.id !== filter.id);
        } else {
            newFilters = [...activeFilters, filter];
        }
        onFilterChange(newFilters);
    };

    const removeFilter = (e, filter) => {
        e.stopPropagation();
        const newFilters = activeFilters.filter(f => f.id !== filter.id);
        onFilterChange(newFilters);
    };

    const handleChipClick = (filter) => {
        if (filter.id.startsWith('advanced_')) {
            setFilterToEdit(filter);
            setAdvancedOpen(true);
            setIsOpen(false); // Close dropdown when opening modal
        } else {
            toggleFilter(filter);
        }
    };

    const handleAddFilter = (filter) => {
        if (filterToEdit) {
            const newFilters = activeFilters.map(f => f.id === filterToEdit.id ? filter : f);
            onFilterChange(newFilters);
            setFilterToEdit(null);
        } else {
            onFilterChange([...activeFilters, filter]);
        }
    };

    const handleCloseAdvanced = () => {
        setAdvancedOpen(false);
        setFilterToEdit(null);
    };

    const activeCount = activeFilters.length;

    return (
        <div className="screener-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                className="interval-dropdown-btn"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '8px 16px',
                    background: activeCount > 0 ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${activeCount > 0 ? 'rgba(61, 220, 132, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: activeCount > 0 ? '#7ff0a0' : '#eaeaea',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                }}
            >
                <span>⚡ Screener {activeCount > 0 && `(${activeCount})`}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {isOpen && (
                <div className="screener-dropdown-menu">
                    <div className="screener-section">
                        <div className="screener-section-title">Quick Filters</div>
                        <div className="screener-chips-grid">
                            {QUICK_FILTERS.map(filter => {
                                const isActive = activeFilters.some(f => f.id === filter.id);
                                return (
                                    <button
                                        key={filter.id}
                                        className={`screener-chip ${isActive ? 'active' : ''}`}
                                        onClick={() => toggleFilter(filter)}
                                    >
                                        {filter.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {activeFilters.some(f => !QUICK_FILTERS.find(qf => qf.id === f.id)) && (
                        <div className="screener-section">
                            <div className="screener-section-title">Custom Filters</div>
                            <div className="screener-chips-grid">
                                {activeFilters.filter(f => !QUICK_FILTERS.find(qf => qf.id === f.id)).map(filter => (
                                    <button
                                        key={filter.id}
                                        className="screener-chip active"
                                        onClick={() => handleChipClick(filter)}
                                    >
                                        {filter.label}
                                        <span
                                            className="screener-chip-remove"
                                            onClick={(e) => removeFilter(e, filter)}
                                        >
                                            ✕
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="screener-footer">
                        <div className="screener-stats">
                            Matching: <strong>{resultCount}</strong> / {totalCount}
                        </div>
                        <div className="screener-actions">
                            <button
                                className="screener-btn screener-btn-primary"
                                onClick={() => {
                                    setEditorOpen(true);
                                    setIsOpen(false);
                                }}
                            >
                                + Custom
                            </button>
                            <button
                                className="screener-btn screener-btn-secondary"
                                onClick={() => {
                                    setAdvancedOpen(true);
                                    setIsOpen(false);
                                }}
                            >
                                + Advanced
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editorOpen && (
                <StrategyEditor
                    onSave={handleAddFilter}
                    onClose={() => setEditorOpen(false)}
                />
            )}

            {advancedOpen && (
                <AdvancedStrategyBuilder
                    initialFilter={filterToEdit}
                    onSave={handleAddFilter}
                    onClose={handleCloseAdvanced}
                />
            )}
        </div>
    );
}
