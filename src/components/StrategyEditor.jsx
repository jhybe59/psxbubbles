import React, { useState } from 'react';
import './StrategyEditor.css';

const FIELDS = [
    { id: 'price', label: 'Price' },
    { id: 'volume', label: 'Volume' },
    { id: 'rsi', label: 'RSI' },
    { id: 'changePct', label: 'Change %' },
    { id: 'daily_change_1d', label: 'Daily Change %' },
    { id: 'sma_20', label: 'SMA 20' },
    { id: 'sma_50', label: 'SMA 50' },
    { id: 'ema_20', label: 'EMA 20' },
    { id: 'bb_upper', label: 'Upper Bollinger' },
    { id: 'bb_lower', label: 'Lower Bollinger' },
    { id: 'open', label: 'Open' },
    { id: 'high', label: 'High' },
    { id: 'low', label: 'Low' },
    { id: 'avg_volume', label: 'Avg Volume' },
    { id: 'volatility', label: 'Volatility' },
    { id: 'relative_volume', label: 'Relative Volume' },
    // Previous bar data for breakout detection
    { id: 'prev_close', label: 'Previous Close' },
    { id: 'prev_open', label: 'Previous Open' },
    { id: 'prev_high', label: 'Previous High' },
    { id: 'prev_low', label: 'Previous Low' },
    { id: 'prev_volume', label: 'Previous Volume' }
];

const OPERATORS = [
    { id: 'above', label: 'is above' },
    { id: 'below', label: 'is below' },
    { id: 'aboveOrEqual', label: 'is above or equal' },
    { id: 'belowOrEqual', label: 'is below or equal' },
    { id: 'equal', label: 'is equal to' }
];

const TARGETS = [
    { id: 'value', label: 'Value' },
    ...FIELDS
];

// Lookback configuration
const LOOKBACK_AGGREGATIONS = [
    { id: 'max', label: 'MAX' },
    { id: 'min', label: 'MIN' },
    { id: 'avg', label: 'AVG' },
    { id: 'sum', label: 'SUM' }
];

const LOOKBACK_FIELDS = [
    { id: 'high', label: 'High' },
    { id: 'low', label: 'Low' },
    { id: 'close', label: 'Close' },
    { id: 'volume', label: 'Volume' }
];

const LOOKBACK_PERIODS = [
    { id: '5m', label: '5 Min' },
    { id: '15m', label: '15 Min' },
    { id: '30m', label: '30 Min' },
    { id: '1h', label: '1 Hour' }
];

export default function StrategyEditor({ onSave, onClose }) {
    const [field, setField] = useState('price');
    const [operator, setOperator] = useState('above');
    const [targetType, setTargetType] = useState('value');
    const [targetValue, setTargetValue] = useState('');
    const [targetField, setTargetField] = useState('sma_20');
    const [multiplier, setMultiplier] = useState('1');
    // Lookback state
    const [lookbackAgg, setLookbackAgg] = useState('max');
    const [lookbackField, setLookbackField] = useState('high');
    const [lookbackPeriod, setLookbackPeriod] = useState('15m');

    const handleSave = () => {
        let condition = {
            operator,
        };

        if (targetType === 'value') {
            condition.target = 'value';
            if (operator.includes('above')) condition.min = Number(targetValue);
            if (operator.includes('below')) condition.max = Number(targetValue);
            if (operator === 'equal') { condition.min = Number(targetValue); condition.max = Number(targetValue); }
        } else if (targetType === 'field') {
            condition.target = targetField;
            if (multiplier && multiplier !== '1') {
                condition.multiplier = Number(multiplier);
            }
        } else if (targetType === 'lookback') {
            // Build lookback target field: max_high_15m, min_low_5m, etc.
            condition.target = `${lookbackAgg}_${lookbackField}_${lookbackPeriod}`;
        }

        // Build label
        let targetLabel;
        if (targetType === 'value') {
            targetLabel = targetValue;
        } else if (targetType === 'field') {
            targetLabel = (multiplier !== '1' ? `${multiplier}x ` : '') + FIELDS.find(f => f.id === targetField)?.label;
        } else {
            const aggLabel = LOOKBACK_AGGREGATIONS.find(a => a.id === lookbackAgg)?.label;
            const fieldLabel = LOOKBACK_FIELDS.find(f => f.id === lookbackField)?.label;
            const periodLabel = LOOKBACK_PERIODS.find(p => p.id === lookbackPeriod)?.label;
            targetLabel = `${aggLabel}(${fieldLabel}) of Last ${periodLabel}`;
        }

        const filter = {
            id: Date.now().toString(),
            label: `${FIELDS.find(f => f.id === field)?.label} ${OPERATORS.find(o => o.id === operator)?.label} ${targetLabel}`,
            conditions: {
                [field]: condition
            }
        };

        onSave(filter);
        onClose();
    };

    return (
        <div className="strategy-editor-backdrop" onClick={onClose}>
            <div className="strategy-editor-panel" onClick={e => e.stopPropagation()}>
                <div className="strategy-header">
                    <h3>New Strategy</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="strategy-builder">
                    <div className="strategy-row">
                        <span className="strategy-text">If</span>
                        <select value={field} onChange={e => setField(e.target.value)}>
                            {FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>

                    <div className="strategy-row">
                        <select value={operator} onChange={e => setOperator(e.target.value)}>
                            {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                    </div>

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
                                Indicator
                            </button>
                            <button
                                className={targetType === 'lookback' ? 'active' : ''}
                                onClick={() => setTargetType('lookback')}
                            >
                                Lookback
                            </button>
                        </div>
                    </div>

                    <div className="strategy-row">
                        {targetType === 'value' ? (
                            <input
                                type="number"
                                value={targetValue}
                                onChange={e => setTargetValue(e.target.value)}
                                placeholder="Enter value..."
                                autoFocus
                            />
                        ) : targetType === 'field' ? (
                            <div className="field-multiplier-group">
                                <input
                                    type="number"
                                    className="multiplier-input"
                                    value={multiplier}
                                    onChange={e => setMultiplier(e.target.value)}
                                    placeholder="1x"
                                    title="Multiplier (e.g. 2 for 2x)"
                                />
                                <span className="x-label">x</span>
                                <select value={targetField} onChange={e => setTargetField(e.target.value)}>
                                    {FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className="lookback-group">
                                <select value={lookbackAgg} onChange={e => setLookbackAgg(e.target.value)}>
                                    {LOOKBACK_AGGREGATIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                                </select>
                                <span className="lookback-text">of</span>
                                <select value={lookbackField} onChange={e => setLookbackField(e.target.value)}>
                                    {LOOKBACK_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                </select>
                                <span className="lookback-text">over last</span>
                                <select value={lookbackPeriod} onChange={e => setLookbackPeriod(e.target.value)}>
                                    {LOOKBACK_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="strategy-footer">
                    <button className="save-btn" onClick={handleSave}>
                        Add Filter
                    </button>
                </div>
            </div>
        </div>
    );
}
