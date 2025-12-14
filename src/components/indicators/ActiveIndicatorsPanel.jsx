import React from 'react';

/**
 * Active Indicators Panel
 * Shows list of active indicators with toggle visibility, settings, and remove
 */
export default function ActiveIndicatorsPanel({
    indicators = [],
    indicatorValues = {},
    onToggleVisibility,
    onRemove,
    onSettings,
    compact = false
}) {
    if (indicators.length === 0) return null;

    const formatValue = (value) => {
        if (value == null) return '-';
        if (typeof value === 'number') {
            return value >= 1000 ? value.toFixed(2) : value.toFixed(4);
        }
        return value;
    };

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: compact ? '6px' : '8px',
            fontSize: compact ? '11px' : '12px',
            fontFamily: 'monospace'
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
                            padding: compact ? '2px 6px' : '4px 8px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '4px',
                            borderLeft: `3px solid ${ind.color}`,
                            opacity: ind.visible ? 1 : 0.5
                        }}
                    >
                        {/* Visibility Toggle */}
                        <button
                            onClick={() => onToggleVisibility(ind.instanceId)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: compact ? '10px' : '12px',
                                color: ind.visible ? '#94a3b8' : '#475569',
                                lineHeight: 1
                            }}
                            title={ind.visible ? 'Hide indicator' : 'Show indicator'}
                        >
                            {ind.visible ? '👁' : '👁‍🗨'}
                        </button>

                        {/* Indicator Name & Value */}
                        <span style={{ color: '#94a3b8' }}>
                            {ind.shortName}
                            {ind.params.period && ` ${ind.params.period}`}
                        </span>
                        <span style={{ color: ind.color, fontWeight: 500 }}>
                            {displayValue}
                        </span>

                        {/* Remove Button */}
                        <button
                            onClick={() => onRemove(ind.instanceId)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: compact ? '12px' : '14px',
                                color: '#475569',
                                lineHeight: 1,
                                marginLeft: '2px'
                            }}
                            title="Remove indicator"
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
