import React, { useState } from 'react';

/**
 * Active Indicators Dropdown
 * TradingView-style collapsible panel showing active indicators
 * Positioned at top-right corner of chart
 */
export default function ActiveIndicatorsDropdown({
    indicators = [],
    indicatorValues = {},
    onToggleVisibility,
    onRemove,
    onSettings,
    placement = 'right' // 'left' or 'right'
}) {
    const [isExpanded, setIsExpanded] = useState(() => {
        try {
            const stored = localStorage.getItem('chart_indicators_dropdown_expanded');
            return stored !== null ? JSON.parse(stored) : true;
        } catch (e) {
            return true;
        }
    });

    const toggleExpanded = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        localStorage.setItem('chart_indicators_dropdown_expanded', JSON.stringify(newState));
    };

    if (indicators.length === 0) return null;

    const formatValue = (value) => {
        if (value == null) return '-';
        if (typeof value === 'object' && value.value !== undefined) {
            return formatValue(value.value);
        }
        if (typeof value === 'number') {
            return value >= 1000 ? value.toFixed(2) : value.toFixed(4);
        }
        return value;
    };

    const isLeft = placement === 'left';

    return (
        <div style={{
            position: 'absolute',
            top: '8px',
            [isLeft ? 'left' : 'right']: '8px',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isLeft ? 'flex-start' : 'flex-end',
            gap: '4px',
            maxWidth: '300px'
        }}>
            {/* Collapse/Expand Toggle */}
            <button
                onClick={toggleExpanded}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500
                }}
            >
                <span style={{ fontSize: '12px' }}>{indicators.length}</span>
                <span style={{ fontSize: '9px', marginLeft: '2px' }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {/* Indicators List */}
            {isExpanded && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    {indicators.map(ind => {
                        const value = indicatorValues[ind.instanceId];
                        const displayValue = formatValue(value);

                        return (
                            <div
                                key={ind.instanceId}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    opacity: ind.visible ? 1 : 0.5,
                                    background: 'rgba(51, 65, 85, 0.3)',
                                    minWidth: '120px'
                                }}
                            >
                                {/* Color indicator */}
                                <div style={{
                                    width: '3px',
                                    height: '16px',
                                    borderRadius: '2px',
                                    background: ind.color
                                }} />

                                {/* Visibility Toggle */}
                                <button
                                    onClick={() => onToggleVisibility(ind.instanceId)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        color: ind.visible ? '#94a3b8' : '#475569',
                                        lineHeight: 1
                                    }}
                                    title={ind.visible ? 'Hide' : 'Show'}
                                >
                                    {ind.visible ? '👁' : '👁‍🗨'}
                                </button>

                                {/* Indicator Name & Value */}
                                <div style={{ flex: 1, fontSize: '11px', fontFamily: 'monospace' }}>
                                    <span style={{ color: '#94a3b8' }}>
                                        {ind.shortName}
                                        {ind.params.period && ` ${ind.params.period}`}
                                    </span>
                                    <span style={{ color: ind.color, fontWeight: 500, marginLeft: '6px' }}>
                                        {displayValue}
                                    </span>
                                </div>

                                {/* Settings Button */}
                                <button
                                    onClick={() => onSettings(ind)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '2px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        color: '#475569',
                                        lineHeight: 1,
                                        marginRight: '2px'
                                    }}
                                    title="Settings"
                                >
                                    ⚙️
                                </button>

                                {/* Remove Button */}
                                <button
                                    onClick={() => onRemove(ind.instanceId)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '2px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        color: '#475569',
                                        lineHeight: 1
                                    }}
                                    title="Remove"
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
