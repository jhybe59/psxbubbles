import React from 'react';

/**
 * Indicator Button - Opens the indicator selector
 */
export default function IndicatorButton({ onClick, activeCount = 0 }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                background: activeCount > 0 ? 'rgba(41, 98, 255, 0.15)' : '#334155',
                border: activeCount > 0 ? '1px solid rgba(41, 98, 255, 0.4)' : '1px solid transparent',
                borderRadius: '4px',
                color: activeCount > 0 ? '#2962FF' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.15s ease'
            }}
            title="Add Indicators"
        >
            <span style={{ fontSize: '14px' }}>📊</span>
            <span>Indicators</span>
            {activeCount > 0 && (
                <span style={{
                    background: '#2962FF',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    minWidth: '16px',
                    textAlign: 'center'
                }}>
                    {activeCount}
                </span>
            )}
        </button>
    );
}
