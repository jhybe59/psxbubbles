import React, { useState, useRef, useEffect } from 'react';
import './ScreenerDropdown.css';
import StrategyEditor from './StrategyEditor';
import AdvancedStrategyBuilder from './AdvancedStrategyBuilder';

const PRESETS_KEY = 'psx_bubbles_filter_presets';

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
        id: 'high_rvol',
        label: '🔥 High Tick RVOL (>3x)',
        conditions: {
            rvol: { min: 3 }
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
        id: 'orb_5m',
        label: '🚀 ORB Breakout 5m',
        description: 'Price above 5-minute Opening Range High',
        conditions: {
            price: { operator: 'above', target: 'orb_high_5m' }
        }
    },
    {
        id: 'orb_15m',
        label: '🎯 ORB Breakout 15m',
        description: 'Price above 15-minute Opening Range High',
        conditions: {
            price: { operator: 'above', target: 'orb_high_15m' }
        }
    },
    {
        id: 'orb_30m',
        label: '💎 ORB Breakout 30m',
        description: 'Price above 30-minute Opening Range High',
        conditions: {
            price: { operator: 'above', target: 'orb_high_30m' }
        }
    },
    {
        id: 'squeeze_on',
        label: '🟠 Squeeze On',
        description: 'Bollinger Bands inside Keltner Channels (Compression)',
        conditions: {
            squeeze_on: { min: 1 }
        }
    },
    {
        id: 'vol_expansion',
        label: '💥 Vol Expansion',
        description: 'Bollinger Bands outside Keltner Channels (Breakout)',
        conditions: {
            bb_width: { operator: 'above', target: 'kc_width' }
        }
    },
    {
        id: 'power_breakout',
        label: '🚀 Power Breakout',
        description: 'Confirmed Breakout: Vol Expansion + High RVOL (>1.5x)',
        conditions: {
            bb_width: { operator: 'above', target: 'kc_width' },
            relative_volume: { min: 1.5 },
            squeeze_on: { max: 0 }
        }
    },
    {
        id: 'bullish_breakout',
        label: '🔥 Bullish Breakout',
        description: 'STRICT LONG: Above ORB High + RVOL > 2.5x + Vol Expansion + Up Trend',
        conditions: {
            price_change_percentage_24h: { min: 0.5 },
            price: { operator: 'above', target: 'orb_high_30m' },
            relative_volume: { min: 2.5 },
            bb_width: { operator: 'above', target: 'kc_width' },
            squeeze_on: { max: 0 }
        }
    }
];

// Load presets from localStorage
const loadPresetsFromStorage = () => {
    try {
        const saved = localStorage.getItem(PRESETS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Failed to load presets:', e);
        return [];
    }
};

// Save presets to localStorage
const savePresetsToStorage = (presets) => {
    try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch (e) {
        console.error('Failed to save presets:', e);
    }
};

export default function ScreenerDropdown({
    activeFilters,
    onFilterChange,
    resultCount,
    totalCount,
    breakoutAlertsEnabled = true,
    setBreakoutAlertsEnabled = () => { }
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [filterToEdit, setFilterToEdit] = useState(null);
    const dropdownRef = useRef(null);

    // Presets state
    const [savedPresets, setSavedPresets] = useState([]);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [presetName, setPresetName] = useState('');

    // Load presets from localStorage on mount
    useEffect(() => {
        setSavedPresets(loadPresetsFromStorage());
    }, []);

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

    // Save current filters as preset
    const saveAsPreset = () => {
        if (!presetName.trim()) return;

        const newPreset = {
            id: `preset_${Date.now()}`,
            name: presetName.trim(),
            filters: activeFilters,
            createdAt: new Date().toISOString()
        };

        const updatedPresets = [...savedPresets, newPreset];
        setSavedPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);

        setPresetName('');
        setShowPresetModal(false);
    };

    // Load a preset
    const loadPreset = (preset) => {
        onFilterChange(preset.filters);
    };

    // Delete a preset
    const deletePreset = (e, presetId) => {
        e.stopPropagation();
        const updatedPresets = savedPresets.filter(p => p.id !== presetId);
        setSavedPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);
    };

    // Check if current filters can be saved (has at least one custom filter)
    const hasCustomFilters = activeFilters.some(f => !QUICK_FILTERS.find(qf => qf.id === f.id));

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
                    {/* Breakout Alerts Toggle */}
                    <div className="screener-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '8px' }}>
                        <div
                            className="screener-alert-toggle"
                            onClick={() => setBreakoutAlertsEnabled(!breakoutAlertsEnabled)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                background: breakoutAlertsEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${breakoutAlertsEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '18px' }}>{breakoutAlertsEnabled ? '🚀' : '🔕'}</span>
                                <div>
                                    <div style={{ fontWeight: 600, color: breakoutAlertsEnabled ? '#4ade80' : '#9ca3af', fontSize: '13px' }}>
                                        Breakout Alerts
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                        TTM Squeeze + RVOL + ORB
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                width: '40px',
                                height: '22px',
                                background: breakoutAlertsEnabled ? '#22c55e' : 'rgba(255,255,255,0.15)',
                                borderRadius: '11px',
                                position: 'relative',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '2px',
                                    left: breakoutAlertsEnabled ? '20px' : '2px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                }} />
                            </div>
                        </div>
                    </div>

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

                    {/* My Presets Section */}
                    {savedPresets.length > 0 && (
                        <div className="screener-section">
                            <div className="screener-section-title">💾 My Presets</div>
                            <div className="screener-chips-grid">
                                {savedPresets.map(preset => (
                                    <button
                                        key={preset.id}
                                        className="screener-chip preset-chip"
                                        onClick={() => loadPreset(preset)}
                                        title={`Load: ${preset.name} (${preset.filters.length} filters)`}
                                    >
                                        {preset.name}
                                        <span
                                            className="screener-chip-remove"
                                            onClick={(e) => deletePreset(e, preset.id)}
                                        >
                                            ✕
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

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
                            {hasCustomFilters && (
                                <button
                                    className="screener-btn screener-btn-save"
                                    onClick={() => {
                                        setShowPresetModal(true);
                                        setIsOpen(false);
                                    }}
                                    title="Save current filters as preset"
                                >
                                    💾 Save
                                </button>
                            )}
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

            {/* Preset Name Modal */}
            {showPresetModal && (
                <div className="preset-modal-backdrop" onClick={() => setShowPresetModal(false)}>
                    <div className="preset-modal" onClick={e => e.stopPropagation()}>
                        <div className="preset-modal-header">
                            <h3>💾 Save Preset</h3>
                            <button className="preset-modal-close" onClick={() => setShowPresetModal(false)}>✕</button>
                        </div>
                        <div className="preset-modal-body">
                            <label>Preset Name</label>
                            <input
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="e.g., Morning Strategy"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveAsPreset();
                                    if (e.key === 'Escape') setShowPresetModal(false);
                                }}
                            />
                            <div className="preset-modal-info">
                                Saving {activeFilters.length} filter{activeFilters.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                        <div className="preset-modal-footer">
                            <button className="preset-modal-cancel" onClick={() => setShowPresetModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="preset-modal-save"
                                onClick={saveAsPreset}
                                disabled={!presetName.trim()}
                            >
                                Save Preset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
