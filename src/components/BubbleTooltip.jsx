/**
 * BubbleTooltip - Premium dark-themed tooltip for bubble chart
 * 
 * Features:
 * - Symbol + Price + Day vs Interval % Change comparison
 * - Sparkline SVG (last 10 prices)
 * - Recent prices as ROWS with direction highlighting
 * - Day Volume, Interval Volume, RVOL, Volatility, Update time
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

// Format price change amount
function formatPriceChange(change) {
    if (change == null || isNaN(change)) return '0.00';
    const sign = change >= 0 ? '+' : '';
    const num = Number(change);
    if (Math.abs(num) >= 1000) return `${sign}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${sign}${num.toFixed(2)}`;
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

// Render recent prices as ROWS (not pills)
function renderPriceRows(prices) {
    if (!prices || prices.length === 0) return null;

    // We want most recent first, so reverse
    const recent = [...prices].slice(-5).reverse();

    return (
        <div className="bt-price-rows">
            <div className="bt-price-rows-label">Recent Prices</div>
            {recent.map((price, idx) => {
                // Compare with next item (which is previous in time) to determine direction
                const prevPrice = idx < recent.length - 1 ? recent[idx + 1] : null;
                let direction = 'neutral';
                let change = null;

                if (prevPrice != null) {
                    if (price > prevPrice) {
                        direction = 'up';
                        change = price - prevPrice;
                    } else if (price < prevPrice) {
                        direction = 'down';
                        change = price - prevPrice;
                    }
                }

                return (
                    <div key={idx} className={`bt-price-row ${direction}`}>
                        <span className="bt-price-row-value">{formatPrice(price)}</span>
                        {change != null && (
                            <span className={`bt-price-row-change ${direction}`}>
                                {change >= 0 ? '+' : ''}{formatPrice(Math.abs(change))}
                                <span className="bt-price-row-arrow">
                                    {direction === 'up' ? '▲' : direction === 'down' ? '▼' : ''}
                                </span>
                            </span>
                        )}
                        {idx === 0 && <span className="bt-price-row-latest">Latest</span>}
                    </div>
                );
            })}
        </div>
    );
}

export default function BubbleTooltip({
    symbol,
    name,
    price,
    // Day data
    dayPctChange,
    dayPriceChange,
    // Interval data
    intervalPctChange,
    intervalPriceChange,
    currentInterval = 'Day',
    // Legacy support - if new props not provided, use old ones
    pctChange, // fallback for intervalPctChange
    prices = [],
    // Volume
    dayVolume,
    intervalVolume,
    volume, // fallback for intervalVolume
    // Other metrics
    rvol,
    volatility,
    lastUpdate,
    // New Props for Sidebar
    raw = {},
    orb = {},
    style = {}
}) {
    // Use new props if available, fallback to old ones
    const intPct = intervalPctChange ?? pctChange ?? 0;
    const intVol = intervalVolume ?? volume ?? 0;
    const dayPct = dayPctChange ?? pctChange ?? 0;
    const dayVol = dayVolume ?? volume ?? 0;

    // Calculate price changes if not provided
    const intPriceChg = intervalPriceChange ?? (price != null && intPct != null ? (price * intPct / 100) : 0);
    const dayPriceChg = dayPriceChange ?? (price != null && dayPct != null ? (price * dayPct / 100) : 0);

    const isPositive = intPct >= 0;

    // Extract Today's stats
    // Try raw first (most accurate), then orb/data props
    const todayOpen = raw['Open 1 day'] ?? raw['Open'] ?? raw['open'] ?? orb?.open;
    const todayHigh = raw['High 1 day'] ?? raw['High'] ?? raw['high'] ?? orb?.high;
    const todayLow = raw['Low 1 day'] ?? raw['Low'] ?? raw['low'] ?? orb?.low;

    // Extract ORB stats
    const orbHigh5m = orb?.orb_high_5m ?? raw?.orb_high_5m;
    const orbHigh15m = orb?.orb_high_15m ?? raw?.orb_high_15m;
    const orbHigh30m = orb?.orb_high_30m ?? raw?.orb_high_30m;

    return (
        <div
            className="bubble-tooltip"
            style={style}
            role="tooltip"
            aria-live="polite"
        >
            <div className="bt-container">
                {/* Main Content (Left Side) */}
                <div className="bt-main">
                    {/* Header with Symbol and Price */}
                    <div className="bt-header">
                        <div>
                            <div className="bt-symbol">{symbol || '—'}</div>
                            {name && name !== symbol && (
                                <div className="bt-name">{name}</div>
                            )}
                        </div>
                        <div className="bt-price-block">
                            <div className="bt-price">{formatPrice(price)}</div>
                        </div>
                    </div>

                    {/* Day vs Interval Comparison */}
                    <div className="bt-comparison">
                        {/* Day Change Row */}
                        <div className={`bt-comparison-row ${dayPct >= 0 ? 'up' : 'down'}`}>
                            <span className="bt-comparison-label">Day:</span>
                            <span className="bt-comparison-pct">{formatPercent(dayPct)}</span>
                            <span className="bt-comparison-amt">({formatPriceChange(dayPriceChg)})</span>
                            <span className="bt-comparison-arrow">{dayPct >= 0 ? '▲' : '▼'}</span>
                        </div>

                        {/* Interval Change Row - only show if different from Day */}
                        {currentInterval !== 'Day' && (
                            <div className={`bt-comparison-row ${intPct >= 0 ? 'up' : 'down'}`}>
                                <span className="bt-comparison-label">{currentInterval}:</span>
                                <span className="bt-comparison-pct">{formatPercent(intPct)}</span>
                                <span className="bt-comparison-amt">({formatPriceChange(intPriceChg)})</span>
                                <span className="bt-comparison-arrow">{intPct >= 0 ? '▲' : '▼'}</span>
                            </div>
                        )}
                    </div>

                    {/* Sparkline */}
                    <div className="bt-sparkline">
                        {renderSparkline(prices, isPositive)}
                    </div>

                    {/* Interval Volume Row */}
                    {currentInterval !== 'Day' && intVol > 0 && (
                        <div className="bt-interval-vol">
                            <span className="bt-interval-vol-label">{currentInterval} Vol:</span>
                            <span className="bt-interval-vol-value">{abbrevNumber(intVol)}</span>
                        </div>
                    )}

                    {/* Recent prices as ROWS */}
                    {prices.length > 0 && renderPriceRows(prices)}

                    {/* Meta row */}
                    <div className="bt-meta">
                        <div className="bt-meta-item">
                            <span className="bt-meta-label">Day Vol:</span>
                            <span className="bt-meta-value">{abbrevNumber(dayVol)}</span>
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

                {/* Sidebar (Right Side) */}
                <div className="bt-sidebar">
                    {/* Today's Range Section */}
                    <div className="bt-sidebar-section">
                        <div className="bt-sidebar-header">Today</div>

                        <div className="bt-stat-row">
                            <span className="bt-stat-label">Open</span>
                            <span className="bt-stat-value">{formatPrice(todayOpen)}</span>
                        </div>
                        <div className="bt-stat-row">
                            <span className="bt-stat-label">High</span>
                            <span className="bt-stat-value">{formatPrice(todayHigh)}</span>
                        </div>
                        <div className="bt-stat-row">
                            <span className="bt-stat-label">Low</span>
                            <span className="bt-stat-value">{formatPrice(todayLow)}</span>
                        </div>
                    </div>

                    <div className="bt-sidebar-separator"></div>

                    {/* ORB Levels Section */}
                    <div className="bt-sidebar-section">
                        <div className="bt-sidebar-header">ORB High</div>

                        {orbHigh5m != null && (
                            <div className="bt-stat-row">
                                <span className="bt-stat-label">5m</span>
                                <span className="bt-stat-value">{formatPrice(orbHigh5m)}</span>
                            </div>
                        )}
                        {orbHigh15m != null && (
                            <div className="bt-stat-row">
                                <span className="bt-stat-label">15m</span>
                                <span className="bt-stat-value">{formatPrice(orbHigh15m)}</span>
                            </div>
                        )}
                        {orbHigh30m != null && (
                            <div className="bt-stat-row">
                                <span className="bt-stat-label">30m</span>
                                <span className="bt-stat-value">{formatPrice(orbHigh30m)}</span>
                            </div>
                        )}

                        {/* Fallback if no ORB data */}
                        {orbHigh5m == null && orbHigh15m == null && orbHigh30m == null && (
                            <div style={{ fontSize: '10px', color: '#4a5568', fontStyle: 'italic' }}>
                                No ORB data
                            </div>
                        )}
                    </div>

                    <div className="bt-sidebar-separator"></div>

                    {/* Previous Day Section */}
                    <div className="bt-sidebar-section">
                        <div className="bt-sidebar-header">Previous Day</div>

                        <div className="bt-stat-row">
                            <span className="bt-stat-label">High</span>
                            <span className="bt-stat-value">{formatPrice(orb?.prev_high ?? raw?.prev_high ?? raw?.['Previous High'])}</span>
                        </div>
                        <div className="bt-stat-row">
                            <span className="bt-stat-label">Close</span>
                            <span className="bt-stat-value">{formatPrice(orb?.prev_close ?? raw?.prev_close ?? raw?.['Previous Close'])}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
