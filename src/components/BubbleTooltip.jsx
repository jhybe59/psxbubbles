/**
 * BubbleTooltip - Premium dark-themed tooltip for bubble chart
 * 
 * Features:
 * - Symbol + Price + % Change header
 * - Sparkline SVG (last 10 prices)
 * - Recent prices as inline pills
 * - Volume, RVOL, Volatility, Update time
 */

import React from 'react';
import './BubbleTooltip.css';

// Format price with appropriate precision
function formatPrice(price) {
    if (price == null || isNaN(price)) return '—';
    const num = Number(price);
    if (num === 0) return '0.00';
    if (Math.abs(num) >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (Math.abs(num) >= 1) return num.toFixed(2);
    if (Math.abs(num) >= 0.01) return num.toFixed(3);
    return num.toFixed(4);
}

// Format percentage
function formatPercent(pct) {
    if (pct == null || isNaN(pct)) return '0.00%';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${Number(pct).toFixed(2)}%`;
}

// Abbreviate large numbers (volume)
function abbrevNumber(n) {
    if (n == null || isNaN(n)) return '—';
    const num = Number(n);
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
    return num.toLocaleString('en-US');
}

// Render sparkline SVG
function renderSparkline(prices, isPositive) {
    if (!prices || prices.length < 2) {
        return <div className="bt-empty">No trend data</div>;
    }

    const w = 248;
    const h = 36;
    const pad = 4;

    const values = prices.slice(-10);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = (max - min) || 1;

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * (w - pad * 2) + pad;
        const y = h - ((v - min) / span) * (h - pad * 2) - pad;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    // Determine color based on first vs last price
    const trendUp = values[values.length - 1] >= values[0];
    const color = trendUp ? '#10b981' : '#ef4444';

    // Create gradient fill points
    const fillPoints = `${pad},${h - pad} ${points} ${w - pad},${h - pad}`;

    return (
        <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            {/* Gradient fill under line */}
            <defs>
                <linearGradient id={`sparkFill-${trendUp ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon
                fill={`url(#sparkFill-${trendUp ? 'up' : 'down'})`}
                points={fillPoints}
            />
            {/* Main line */}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
            {/* End dot */}
            {values.length > 0 && (
                <circle
                    cx={(values.length - 1) / (values.length - 1) * (w - pad * 2) + pad}
                    cy={h - ((values[values.length - 1] - min) / span) * (h - pad * 2) - pad}
                    r="3"
                    fill={color}
                />
            )}
        </svg>
    );
}

// Render recent price pills
function renderRecentPills(prices) {
    if (!prices || prices.length === 0) return null;

    // Reverse to show most recent first
    const recent = [...prices].reverse();

    // Find biggest price jump for highlighting
    let maxJumpIdx = -1;
    let maxJump = 0;
    for (let i = 1; i < prices.length; i++) {
        const jump = Math.abs(prices[i] - prices[i - 1]);
        if (jump > maxJump) {
            maxJump = jump;
            maxJumpIdx = prices.length - 1 - i; // Convert to reversed index
        }
    }

    return recent.map((price, idx) => {
        let pillClass = 'bt-pill';
        // Highlight the most recent one (idx === 0) is handled by CSS
        // Highlight biggest jump
        if (idx === maxJumpIdx && maxJump > 0) {
            const direction = idx > 0 && recent[idx - 1] ? (price > recent[idx - 1] ? 'up' : 'down') : null;
            if (direction) pillClass += ` highlight-${direction}`;
        }
        return (
            <span key={idx} className={pillClass}>
                {formatPrice(price)}
            </span>
        );
    });
}

export default function BubbleTooltip({
    symbol,
    name,
    price,
    pctChange,
    prices = [],
    volume,
    rvol,
    volatility,
    lastUpdate,
    style = {}
}) {
    const isPositive = pctChange >= 0;
    const isNeutral = Math.abs(pctChange) < 0.005;

    // Calculate trend delta (difference between first and last in prices array)
    let trendDelta = null;
    let trendDeltaPct = null;
    if (prices.length >= 2) {
        const first = prices[0];
        const last = prices[prices.length - 1];
        trendDelta = last - first;
        trendDeltaPct = first !== 0 ? ((last - first) / first) * 100 : 0;
    }

    return (
        <div
            className="bubble-tooltip"
            style={style}
            role="tooltip"
            aria-live="polite"
        >
            {/* Header */}
            <div className="bt-header">
                <div>
                    <div className="bt-symbol">{symbol || '—'}</div>
                    {name && name !== symbol && (
                        <div className="bt-name">{name}</div>
                    )}
                </div>
                <div className="bt-price-block">
                    <div className="bt-price">{formatPrice(price)}</div>
                    <div className={`bt-change ${isNeutral ? 'neutral' : (isPositive ? 'up' : 'down')}`}>
                        {formatPercent(pctChange)}
                        <span className="bt-arrow">{isNeutral ? '●' : (isPositive ? '▲' : '▼')}</span>
                    </div>
                </div>
            </div>

            {/* Sparkline */}
            <div className="bt-sparkline">
                {renderSparkline(prices, isPositive)}
            </div>

            {/* Recent prices */}
            {prices.length > 0 && (
                <div className="bt-recent">
                    <div className="bt-recent-label">Recent ({prices.length})</div>
                    {renderRecentPills(prices)}
                </div>
            )}

            {/* Trend delta summary */}
            {trendDelta !== null && (
                <div className="bt-trend-delta">
                    <span>Trend:</span>
                    <span className={`delta-value ${trendDelta >= 0 ? 'up' : 'down'}`}>
                        {trendDelta >= 0 ? '+' : ''}{formatPrice(Math.abs(trendDelta))} ({trendDeltaPct >= 0 ? '+' : ''}{trendDeltaPct.toFixed(2)}%)
                    </span>
                </div>
            )}

            {/* Meta row */}
            <div className="bt-meta">
                <div className="bt-meta-item">
                    <span className="bt-meta-label">Vol:</span>
                    <span className="bt-meta-value">{abbrevNumber(volume)}</span>
                </div>

                {rvol != null && (
                    <div className="bt-meta-item">
                        <span className="bt-meta-label">RVOL:</span>
                        <span className={`bt-meta-value ${rvol >= 2 ? 'high' : ''}`}>
                            {Number(rvol).toFixed(2)}x
                        </span>
                        {rvol >= 2 && <span className="bt-badge rvol-high">🔥</span>}
                    </div>
                )}

                {volatility != null && volatility > 0 && (
                    <div className="bt-meta-item">
                        <span className="bt-meta-label">Vol%:</span>
                        <span className={`bt-meta-value ${volatility >= 5 ? 'high' : ''}`}>
                            {Number(volatility).toFixed(2)}%
                        </span>
                    </div>
                )}

                <div className="bt-meta-item" style={{ marginLeft: 'auto' }}>
                    <span className="bt-meta-label">Updated:</span>
                    <span className="bt-meta-value">{lastUpdate || '—'}</span>
                </div>
            </div>
        </div>
    );
}
