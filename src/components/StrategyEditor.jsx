import React, { useState, useEffect } from 'react';
import './StrategyEditor.css';

// Interval options for the filter - empty means use global/chart interval
const INTERVALS = [
    { id: '', label: '-' },
    { id: '1m', label: '1M' },
    { id: '5m', label: '5M' },
    { id: '15m', label: '15M' },
    { id: '1h', label: '1H' },
    { id: '1d', label: '1D' },
    { id: '1w', label: '1W' },
    { id: '1mo', label: '1Mo' },
    { id: '1y', label: '1Y' },
];

// Source fields - what to compare
const SOURCE_FIELDS = [
    { id: 'price', label: 'Price' },
    { id: 'volume', label: 'Volume' },
    { id: 'day_volume', label: 'Day Volume' },
    { id: 'changePct', label: 'Change %' },
    { id: 'day_change', label: 'Day Change %' },
    { id: 'rsi', label: 'RSI' },
    { id: 'volatility', label: 'Volatility' },
    { id: 'relative_volume', label: 'Relative Volume' },
    { id: 'candle_body_pct', label: 'Candle Body %' },
    { id: 'open', label: 'Open' },
    { id: 'high', label: 'High' },
    { id: 'low', label: 'Low' },
    { id: 'close', label: 'Close' },
];

const OPERATORS = [
    { id: 'above', label: 'is above' },
    { id: 'below', label: 'is below' },
    { id: 'aboveOrEqual', label: 'is ≥' },
    { id: 'belowOrEqual', label: 'is ≤' },
    { id: 'equal', label: 'equals' }
];

// Grouped comparison targets
const COMPARE_GROUPS = [
    {
        id: 'indicators',
        label: '📈 Indicators',
        options: [
            { id: 'sma_20', label: 'SMA 20' },
            { id: 'sma_50', label: 'SMA 50' },
            { id: 'sma_200', label: 'SMA 200' },
            { id: 'ema_20', label: 'EMA 20' },
            { id: 'bb_upper', label: 'Upper Bollinger' },
            { id: 'bb_middle', label: 'Middle Bollinger' },
            { id: 'bb_lower', label: 'Lower Bollinger' },
        ]
    },
    {
        id: 'volume',
        label: '📊 Volume',
        options: [
            { id: 'avg_volume', label: 'Avg Volume' },
            { id: 'prev_volume', label: 'Prev Volume' },
            { id: 'relative_volume', label: 'RVOL (Relative Vol)' },
            { id: 'prev_rvol', label: 'Prev RVOL' },
            { id: 'volume_ma', label: 'Volume MA', hasPeriodInput: true },
        ]
    },
    {
        id: 'volatility',
        label: '🌊 Volatility',
        options: [
            { id: 'volatility', label: 'Volatility' },
            { id: 'prev_volatility', label: 'Prev Volatility' },
        ]
    },
    {
        id: 'lookback',
        label: '⏳ Lookback',
        options: [
            { id: 'max_high_15m', label: 'MAX High 15m' },
            { id: 'min_low_15m', label: 'MIN Low 15m' },
            { id: 'max_high_1h', label: 'MAX High 1h' },
            { id: 'min_low_1h', label: 'MIN Low 1h' },
            { id: 'avg_volume_15m', label: 'AVG Volume 15m' },
            { id: 'avg_volume_1h', label: 'AVG Volume 1h' },
        ]
    },
    {
        id: 'prev_bar',
        label: '💰 Previous Bar (1 back)',
        options: [
            { id: 'prev_close', label: 'Prev Close' },
            { id: 'prev_open', label: 'Prev Open' },
            { id: 'prev_high', label: 'Prev High' },
            { id: 'prev_low', label: 'Prev Low' },
            { id: 'prev_volume', label: 'Prev Volume' },
            { id: 'prev_volatility', label: 'Prev Volatility' },
            { id: 'prev_rvol', label: 'Prev RVOL' },
        ]
    },
    {
        id: 'prev_prev_bar',
        label: '🔥 2-Candles Back (Strong)',
        options: [
            { id: 'prev_prev_high', label: 'Prev-Prev High' },
            { id: 'prev_prev_low', label: 'Prev-Prev Low' },
            { id: 'prev_prev_close', label: 'Prev-Prev Close' },
            { id: 'prev_prev_open', label: 'Prev-Prev Open' },
        ]
    },
    {
        id: 'orb',
        label: '🚀 ORB (Opening Range)',
        options: [
            { id: 'orb_high_5m', label: 'ORB High 5m' },
            { id: 'orb_low_5m', label: 'ORB Low 5m' },
            { id: 'orb_high_15m', label: 'ORB High 15m' },
            { id: 'orb_low_15m', label: 'ORB Low 15m' },
            { id: 'orb_high_30m', label: 'ORB High 30m' },
            { id: 'orb_low_30m', label: 'ORB Low 30m' },
        ]
    }
];

// Flatten for lookup
const allCompareOptions = COMPARE_GROUPS.flatMap(g => g.options);

export default function StrategyEditor({ initialFilter, onSave, onClose }) {
    const [field, setField] = useState('volume');
    const [interval, setInterval] = useState(''); // Empty = use global chart interval
    const [operator, setOperator] = useState('above');
    const [targetType, setTargetType] = useState('field'); // 'value' or 'field'
    const [targetValue, setTargetValue] = useState('');
    const [compareField, setCompareField] = useState('avg_volume');
    const [volumeMaPeriod, setVolumeMaPeriod] = useState('20');

    // Check if current compare field needs period input
    const selectedOption = allCompareOptions.find(o => o.id === compareField);
    const needsPeriodInput = selectedOption?.hasPeriodInput || false;

    // Hydrate from initialFilter
    useEffect(() => {
        if (initialFilter?.conditions) {
            const keys = Object.keys(initialFilter.conditions);
            if (keys.length > 0) {
                const f = keys[0];
                const cond = initialFilter.conditions[f];

                setField(f);
                setOperator(cond.operator || 'above');
                setInterval(cond.interval || '');

                if (cond.target === 'value') {
                    setTargetType('value');
                    setTargetValue(cond.min ?? cond.max ?? '');
                } else {
                    setTargetType('field');
                    // Check for dynamic volume_ma pattern
                    if (cond.target?.startsWith('volume_ma_')) {
                        setCompareField('volume_ma');
                        setVolumeMaPeriod(cond.target.split('_')[2] || '20');
                    } else {
                        setCompareField(cond.target || 'avg_volume');
                    }
                }
            }
        }
    }, [initialFilter]);

    const handleSave = () => {
        // Only include interval if explicitly selected
        let condition = { operator };
        if (interval) {
            condition.interval = interval;
        }

        if (targetType === 'value') {
            condition.target = 'value';
            if (operator.includes('above') || operator === 'aboveOrEqual') {
                condition.min = Number(targetValue);
            }
            if (operator.includes('below') || operator === 'belowOrEqual') {
                condition.max = Number(targetValue);
            }
            if (operator === 'equal') {
                condition.min = Number(targetValue);
                condition.max = Number(targetValue);
            }
        } else {
            // Build target - handle Volume MA specially
            if (compareField === 'volume_ma') {
                condition.target = `volume_ma_${volumeMaPeriod}`;
            } else {
                condition.target = compareField;
            }
        }

        // Build label
        const fieldLabel = SOURCE_FIELDS.find(f => f.id === field)?.label || field;
        const opLabel = OPERATORS.find(o => o.id === operator)?.label || operator;
        const intervalLabel = interval ? ` (${INTERVALS.find(i => i.id === interval)?.label || interval})` : '';
        let targetLabel;

        if (targetType === 'value') {
            targetLabel = targetValue;
        } else {
            if (compareField === 'volume_ma') {
                targetLabel = `Vol MA(${volumeMaPeriod})`;
            } else {
                targetLabel = allCompareOptions.find(o => o.id === compareField)?.label || compareField;
            }
        }

        const filter = {
            id: initialFilter?.id || Date.now().toString(),
            label: `${fieldLabel}${intervalLabel} ${opLabel} ${targetLabel}`,
            conditions: { [field]: condition }
        };

        onSave(filter);
        onClose();
    };

    return (
        <div className="strategy-editor-backdrop" onClick={onClose}>
            <div className="strategy-editor-panel" onClick={e => e.stopPropagation()}>
                <div className="strategy-header">
                    <h3>Custom Strategy</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="strategy-builder">
                    {/* Source Field with optional Interval on right */}
                    <div className="strategy-row">
                        <span className="strategy-label">If</span>
                        <select
                            className="field-select"
                            value={field}
                            onChange={e => setField(e.target.value)}
                        >
                            {SOURCE_FIELDS.map(f => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                        </select>
                        <select
                            className="interval-select"
                            value={interval}
                            onChange={e => setInterval(e.target.value)}
                            title="Timeframe (- = use chart interval)"
                        >
                            {INTERVALS.map(i => (
                                <option key={i.id} value={i.id}>{i.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Operator */}
                    <div className="strategy-row">
                        <select value={operator} onChange={e => setOperator(e.target.value)}>
                            {OPERATORS.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Target Type Toggle */}
                    <div className="strategy-row">
                        <div className="toggle-group">
                            <button
                                className={targetType === 'value' ? 'active' : ''}
                                onClick={() => setTargetType('value')}
                            >
                                Value
                            </button>
                            <button
                                className={targetType === 'field' ? 'active' : ''}
                                onClick={() => setTargetType('field')}
                            >
                                Compare To
                            </button>
                        </div>
                    </div>

                    {/* Target Input */}
                    <div className="strategy-row">
                        {targetType === 'value' ? (
                            <input
                                type="number"
                                value={targetValue}
                                onChange={e => setTargetValue(e.target.value)}
                                placeholder="Enter value..."
                                autoFocus
                            />
                        ) : (
                            <div className="compare-group">
                                <select
                                    value={compareField}
                                    onChange={e => setCompareField(e.target.value)}
                                    className="compare-select"
                                >
                                    {COMPARE_GROUPS.map(group => (
                                        <optgroup key={group.id} label={group.label}>
                                            {group.options.map(opt => (
                                                <option key={opt.id} value={opt.id}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>

                                {/* Volume MA Period Input */}
                                {needsPeriodInput && (
                                    <div className="period-row">
                                        <span className="period-label">Period:</span>
                                        <input
                                            type="number"
                                            className="period-input"
                                            value={volumeMaPeriod}
                                            onChange={e => setVolumeMaPeriod(e.target.value)}
                                            min="1"
                                            max="200"
                                            placeholder="20"
                                        />
                                        <span className="period-suffix">bars</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="strategy-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="save-btn" onClick={handleSave}>
                        {initialFilter ? 'Update Filter' : 'Add Filter'}
                    </button>
                </div>
            </div>
        </div>
    );
}
