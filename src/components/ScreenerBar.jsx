import React, { useState } from 'react';
import './ScreenerBar.css';
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
        id: 'vol_ma_breakout',
        label: '📊 Vol > MA(20)',
        conditions: {
            volume: { operator: 'above', target: 'volume_ma_20' }
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
    },
    {
        id: 'micro_breakout',
        label: '⚡ Micro Breakout',
        conditions: {
            price: { operator: 'above', target: 'prev_high' }
        }
    },
    {
        id: 'strong_breakout',
        label: '🔥 Strong Breakout',
        conditions: {
            price: { operator: 'above', target: 'prev_prev_high' }
        }
    },
    {
        id: 'ultimate_breakout',
        label: '💎 Momentum Breakout',
        conditions: {
            price: { operator: 'above', target: 'prev_high' },
            volume: { operator: 'above', target: 'prev_volume' },
            relative_volume: { operator: 'above', target: 'prev_rvol' }
        }
    }
];

export default function ScreenerBar({ activeFilters, onFilterChange, resultCount, totalCount }) {
    const [editorOpen, setEditorOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [filterToEdit, setFilterToEdit] = useState(null);

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
        } else {
            setFilterToEdit(filter);
            setEditorOpen(true);
        }
    };

    const handleAddFilter = (filter) => {
        // If editing, replace the old filter
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

    const handleCloseEditor = () => {
        setEditorOpen(false);
        setFilterToEdit(null);
    };

    return (
        <div className="screener-bar-container">
            <div className="screener-bar">
                <div className="screener-label">
                    <span className="screener-icon">⚡</span>
                    <span className="screener-text">SCREENER</span>
                </div>

                <div className="screener-chips">
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
                    {activeFilters.filter(f => !QUICK_FILTERS.find(qf => qf.id === f.id)).map(filter => (
                        <button
                            key={filter.id}
                            className="screener-chip active custom-chip"
                            onClick={() => handleChipClick(filter)}
                        >
                            {filter.label}
                            <span
                                style={{ opacity: 0.6, marginLeft: 6, padding: '0 2px' }}
                                onClick={(e) => removeFilter(e, filter)}
                            >
                                ✕
                            </span>
                        </button>
                    ))}
                </div>

                <div className="screener-stats">
                    <span className="screener-count">
                        Matching: <strong>{resultCount}</strong> / {totalCount}
                    </span>
                    <button
                        className="screener-add-btn"
                        onClick={() => setEditorOpen(true)}
                    >
                        + Custom
                    </button>
                    <button
                        className="screener-add-btn screener-advanced-btn"
                        onClick={() => setAdvancedOpen(true)}
                    >
                        + Advanced
                    </button>
                </div>
            </div>

            {editorOpen && (
                <StrategyEditor
                    initialFilter={filterToEdit}
                    onSave={handleAddFilter}
                    onClose={handleCloseEditor}
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
