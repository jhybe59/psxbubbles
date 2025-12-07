import React, { useState, useRef, useEffect } from 'react';
import './AdvancedStrategyBuilder.css';

// Categories and their fields
const CATEGORIES = [
    {
        id: 'volume',
        label: '📊 Volume',
        icon: '📊',
        fields: [
            { id: 'volume', label: 'Volume' },
            { id: 'avg_volume', label: 'Avg Volume' },
            { id: 'relative_volume', label: 'Relative Volume' },
            { id: 'dailyVolume', label: 'Daily Volume' },
            { id: 'volume_ma_10', label: 'Vol MA(10)' },
            { id: 'volume_ma_20', label: 'Vol MA(20)' },
            { id: 'volume_ma_50', label: 'Vol MA(50)' },
        ]
    },
    {
        id: 'price',
        label: '💰 Price',
        icon: '💰',
        fields: [
            { id: 'price', label: 'Price' },
            { id: 'open', label: 'Open' },
            { id: 'high', label: 'High' },
            { id: 'low', label: 'Low' },
            { id: 'close', label: 'Close' },
        ]
    },
    {
        id: 'indicators',
        label: '📉 Indicators',
        icon: '📉',
        fields: [
            { id: 'rsi', label: 'RSI' },
            { id: 'sma_20', label: 'SMA 20' },
            { id: 'sma_50', label: 'SMA 50' },
            { id: 'sma_200', label: 'SMA 200' },
            { id: 'ema_20', label: 'EMA 20' },
            { id: 'volatility', label: 'Volatility' },
        ]
    },
    {
        id: 'previous',
        label: '⏮️ Previous Bar',
        icon: '⏮️',
        fields: [
            { id: 'prev_close', label: 'Prev Close' },
            { id: 'prev_open', label: 'Prev Open' },
            { id: 'prev_high', label: 'Prev High' },
            { id: 'prev_low', label: 'Prev Low' },
            { id: 'prev_volume', label: 'Prev Volume' },
        ]
    },
    {
        id: 'lookback',
        label: '⏳ Lookback',
        icon: '⏳',
        fields: [
            { id: 'max_high_15m', label: 'Max High 15m' },
            { id: 'min_low_15m', label: 'Min Low 15m' },
            { id: 'max_high_1h', label: 'Max High 1h' },
            { id: 'min_low_1h', label: 'Min Low 1h' },
            { id: 'avg_volume_15m', label: 'Avg Vol 15m' },
            { id: 'avg_volume_1h', label: 'Avg Vol 1h' },
        ]
    }
];

const OPERATORS = [
    { id: 'above', label: 'is above' },
    { id: 'below', label: 'is below' },
    { id: 'aboveOrEqual', label: 'is ≥' },
    { id: 'belowOrEqual', label: 'is ≤' },
    { id: 'equal', label: 'equals' },
];

const COMPARE_TARGETS = [
    { id: 'value', label: 'Value', type: 'number' },
    { id: 'prev_close', label: 'Previous Close' },
    { id: 'prev_high', label: 'Previous High' },
    { id: 'prev_low', label: 'Previous Low' },
    { id: 'prev_volume', label: 'Previous Volume' },
    { id: 'avg_volume', label: 'Avg Volume' },
    { id: 'sma_20', label: 'SMA 20' },
    { id: 'sma_50', label: 'SMA 50' },
    { id: 'volume_ma_10', label: 'Vol MA(10)' },
    { id: 'volume_ma_20', label: 'Vol MA(20)' },
    { id: 'volume_ma_50', label: 'Vol MA(50)' },
];

const INTERVALS = [
    { id: '1m', label: '1 Minute' },
    { id: '5m', label: '5 Minutes' },
    { id: '15m', label: '15 Minutes' },
    { id: '30m', label: '30 Minutes' },
    { id: '1h', label: '1 Hour' },
    { id: '4h', label: '4 Hours' },
    { id: '1d', label: '1 Day' },
    { id: '1w', label: '1 Week' },
];

export default function AdvancedStrategyBuilder({ initialFilter, onSave, onClose }) {
    const [conditions, setConditions] = useState([]);
    const [activeChip, setActiveChip] = useState(null);
    const [chipConfig, setChipConfig] = useState({});
    const popupRef = useRef(null);

    // Hydrate state from initialFilter if provided (Edit Mode)
    useEffect(() => {
        if (initialFilter && initialFilter.conditions) {
            const loadedConditions = Object.entries(initialFilter.conditions).map(([fieldId, cond]) => {
                // Find field label from categories
                let fieldLabel = fieldId;
                for (const cat of CATEGORIES) {
                    const found = cat.fields.find(f => f.id === fieldId);
                    if (found) {
                        fieldLabel = found.label;
                        break;
                    }
                }

                // Determine target value based on operator
                let val = '';
                if (cond.target === 'value') {
                    if (cond.min != null) val = cond.min;
                    else if (cond.max != null) val = cond.max;
                }

                return {
                    id: `${fieldId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    fieldId: fieldId,
                    fieldLabel: fieldLabel,
                    operator: cond.operator,
                    targetType: cond.target === 'value' ? 'value' : 'field',
                    targetValue: val,
                    targetField: cond.target !== 'value' ? cond.target : '',
                    multiplier: cond.multiplier ? String(cond.multiplier) : '1',
                    interval: cond.interval || '1d'
                };
            });
            setConditions(loadedConditions);
        }
    }, [initialFilter]);

    // Close popup when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setActiveChip(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Add a field as condition
    const addCondition = (field) => {
        const newCondition = {
            id: `${field.id}_${Date.now()}`,
            fieldId: field.id,
            fieldLabel: field.label,
            operator: 'above',
            targetType: 'value',
            targetValue: '',
            targetField: '',
            multiplier: '1',
            interval: '1d', // Default to 1 Day
        };
        setConditions([...conditions, newCondition]);
        setActiveChip(newCondition.id);
        setChipConfig(newCondition);
    };

    // Update condition config
    const updateCondition = (id, updates) => {
        setConditions(conditions.map(c =>
            c.id === id ? { ...c, ...updates } : c
        ));
        setChipConfig(prev => ({ ...prev, ...updates }));
    };

    // Remove condition
    const removeCondition = (id) => {
        setConditions(conditions.filter(c => c.id !== id));
        setActiveChip(null);
    };

    // Open chip config popup
    const openChipConfig = (condition) => {
        setActiveChip(condition.id);
        setChipConfig(condition);
    };

    // Get condition summary for chip display
    const getConditionSummary = (cond) => {
        const op = OPERATORS.find(o => o.id === cond.operator)?.label || cond.operator;
        const int = cond.interval ? ` (${cond.interval})` : '';

        if (cond.targetType === 'value' && cond.targetValue) {
            return `${op} ${cond.targetValue}${int}`;
        }
        if (cond.targetField) {
            const target = COMPARE_TARGETS.find(t => t.id === cond.targetField)?.label || cond.targetField;
            const mult = cond.multiplier && cond.multiplier !== '1' ? ` × ${cond.multiplier}` : '';
            return `${op} ${target}${mult}${int}`;
        }
        return 'Click to configure';
    };

    // Build filter object and save
    const handleApply = () => {
        const filterConditions = {};

        conditions.forEach(cond => {
            const condition = {
                operator: cond.operator,
                interval: cond.interval
            };

            if (cond.targetType === 'value') {
                condition.target = 'value';
                if (cond.operator.includes('above')) {
                    condition.min = Number(cond.targetValue);
                }
                if (cond.operator.includes('below')) {
                    condition.max = Number(cond.targetValue);
                }
                if (cond.operator === 'equal') {
                    condition.min = Number(cond.targetValue);
                    condition.max = Number(cond.targetValue);
                }
            } else {
                condition.target = cond.targetField;
                if (cond.multiplier && cond.multiplier !== '1') {
                    condition.multiplier = Number(cond.multiplier);
                }
            }

            filterConditions[cond.fieldId] = condition;
        });

        // Create filter label
        const labels = conditions.map(c => {
            const summary = getConditionSummary(c);
            return `${c.fieldLabel} ${summary}`;
        });

        const filter = {
            id: initialFilter ? initialFilter.id : `advanced_${Date.now()}`,
            label: labels.join(' & '),
            conditions: filterConditions
        };

        onSave(filter);
        onClose();
    };

    return (
        <div className="asb-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="asb-panel">
                {/* Header */}
                <div className="asb-header">
                    <h3>Build Your Strategy</h3>
                    <button className="asb-close" onClick={onClose}>×</button>
                </div>

                {/* Selected Conditions */}
                <div className="asb-selected">
                    <div className="asb-section-label">SELECTED CONDITIONS:</div>
                    <div className="asb-chips">
                        {conditions.length === 0 ? (
                            <span className="asb-empty">Click an option below to add condition</span>
                        ) : (
                            conditions.map(cond => (
                                <div
                                    key={cond.id}
                                    className={`asb-chip ${activeChip === cond.id ? 'active' : ''}`}
                                    onClick={() => openChipConfig(cond)}
                                >
                                    <span className="asb-chip-label">{cond.fieldLabel}</span>
                                    <span className="asb-chip-summary">{getConditionSummary(cond)}</span>
                                    <span className="asb-chip-arrow">▼</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chip Configuration Popup */}
                {activeChip && (
                    <div className="asb-popup" ref={popupRef}>
                        <div className="asb-popup-header">
                            <span>{chipConfig.fieldLabel} Settings</span>
                            <button onClick={() => setActiveChip(null)}>×</button>
                        </div>
                        <div className="asb-popup-body">
                            {/* Interval Selector */}
                            <div className="asb-popup-row">
                                <label>Interval:</label>
                                <select
                                    value={chipConfig.interval}
                                    onChange={(e) => updateCondition(activeChip, { interval: e.target.value })}
                                >
                                    {INTERVALS.map(int => (
                                        <option key={int.id} value={int.id}>{int.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Operator */}
                            <div className="asb-popup-row">
                                <label>Condition:</label>
                                <select
                                    value={chipConfig.operator}
                                    onChange={(e) => updateCondition(activeChip, { operator: e.target.value })}
                                >
                                    {OPERATORS.map(op => (
                                        <option key={op.id} value={op.id}>{op.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Target Type */}
                            <div className="asb-popup-row">
                                <label>Compare to:</label>
                                <div className="asb-target-options">
                                    <label className="asb-radio">
                                        <input
                                            type="radio"
                                            checked={chipConfig.targetType === 'value'}
                                            onChange={() => updateCondition(activeChip, { targetType: 'value', targetField: '' })}
                                        />
                                        <span>Value</span>
                                    </label>
                                    <label className="asb-radio">
                                        <input
                                            type="radio"
                                            checked={chipConfig.targetType === 'field'}
                                            onChange={() => updateCondition(activeChip, { targetType: 'field' })}
                                        />
                                        <span>Field</span>
                                    </label>
                                </div>
                            </div>

                            {/* Value Input */}
                            {chipConfig.targetType === 'value' && (
                                <div className="asb-popup-row">
                                    <label>Value:</label>
                                    <input
                                        type="number"
                                        value={chipConfig.targetValue}
                                        onChange={(e) => updateCondition(activeChip, { targetValue: e.target.value })}
                                        placeholder="Enter value..."
                                    />
                                </div>
                            )}

                            {/* Field Select */}
                            {chipConfig.targetType === 'field' && (
                                <>
                                    <div className="asb-popup-row">
                                        <label>Field:</label>
                                        <select
                                            value={chipConfig.targetField}
                                            onChange={(e) => updateCondition(activeChip, { targetField: e.target.value })}
                                        >
                                            <option value="">Select field...</option>
                                            {COMPARE_TARGETS.filter(t => t.id !== 'value').map(t => (
                                                <option key={t.id} value={t.id}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="asb-popup-row">
                                        <label>Multiplier:</label>
                                        <input
                                            type="number"
                                            value={chipConfig.multiplier}
                                            onChange={(e) => updateCondition(activeChip, { multiplier: e.target.value })}
                                            step="0.1"
                                            min="0.1"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="asb-popup-footer">
                            <button className="asb-remove" onClick={() => removeCondition(activeChip)}>Remove</button>
                            <button className="asb-done" onClick={() => setActiveChip(null)}>Done</button>
                        </div>
                    </div>
                )}

                {/* Available Options */}
                <div className="asb-options">
                    <div className="asb-section-label">AVAILABLE OPTIONS:</div>
                    {CATEGORIES.map(cat => (
                        <div key={cat.id} className="asb-category">
                            <div className="asb-category-label">{cat.label}</div>
                            <div className="asb-category-fields">
                                {cat.fields.map(field => (
                                    <button
                                        key={field.id}
                                        className="asb-field-btn"
                                        onClick={() => addCondition(field)}
                                    >
                                        {field.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="asb-footer">
                    <button className="asb-clear" onClick={() => setConditions([])}>Clear All</button>
                    <button
                        className="asb-apply"
                        onClick={handleApply}
                        disabled={conditions.length === 0}
                    >
                        {initialFilter ? 'Update Filter' : 'Apply Filter'} ({conditions.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
