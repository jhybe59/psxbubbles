import React from 'react';
import './BubbleTooltip.css';
import { updatePrices, getHistory, getTrend, updatePreviousValues } from '../lib/priceHistoryStore';

/**
 * BubbleTooltip - Premium dark-themed tooltip for bubble chart
 */

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

// Helper: Generate logical logs based on current state (Hybrid Model)
function getLogicalLogs(props) {
    const { price, prices, raw = {}, orb = {}, rvol, volatility } = props;
    const session = [];
    const interval = [];
    const p = Number(price);
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    if (!p) return { session, interval };

    // --- 1. SESSION CONTEXT (Always Visible) ---
    // Use day_high / day_low from backend if available
    const dayHigh = Number(raw.day_high ?? raw['High 1 day'] ?? raw.high ?? orb.day_high ?? orb.high);
    const dayLow = Number(raw.day_low ?? raw['Low 1 day'] ?? raw.low ?? orb.day_low ?? orb.low);
    const prevHigh = Number(raw.prev_high ?? raw['Previous High'] ?? orb.prev_high);
    const prevLow = Number(raw.prev_low ?? raw['Previous Low'] ?? orb.prev_low);

    if (dayHigh && p >= dayHigh) session.push({ type: 'bullish', text: '💥 New Daily High', time: currentTime, category: 'D' });
    else if (dayHigh && p >= dayHigh * 0.999) session.push({ type: 'bullish', text: 'Near Daily High', time: currentTime, category: 'D' });

    if (dayLow && p <= dayLow) session.push({ type: 'bearish', text: '📉 New Daily Low', time: currentTime, category: 'D' });
    else if (dayLow && p <= dayLow * 1.001) session.push({ type: 'bearish', text: 'Near Daily Low', time: currentTime, category: 'D' });

    if (prevHigh && p > prevHigh) session.push({ type: 'bullish', text: '🚀 Broke Prev Day High', time: currentTime, category: 'D' });
    if (prevLow && p < prevLow) session.push({ type: 'bearish', text: '🔻 Broke Prev Day Low', time: currentTime, category: 'D' });

    // ORB Levels
    ['5m', '15m', '30m', '1h'].forEach(tf => {
        const oh = orb[`orb_high_${tf}`] ?? raw[`orb_high_${tf}`];
        const ol = orb[`orb_low_${tf}`] ?? raw[`orb_low_${tf}`];
        if (oh && p > oh) session.push({ type: 'bullish', text: `✅ Crossed ORB ${tf} High`, time: currentTime, category: 'D' });
        if (ol && p < ol) session.push({ type: 'bearish', text: `⚠️ Crossed ORB ${tf} Low`, time: currentTime, category: 'D' });
    });

    // Volume / Volatility
    if (rvol > 3) session.push({ type: 'bullish', text: `🔥 High Rel Vol (${Number(rvol).toFixed(1)}x)`, time: currentTime, category: 'D' });
    if (volatility > 5) session.push({ type: 'neutral', text: `⚡ High Volatility`, time: currentTime, category: 'D' });

    // --- 2. INTERVAL DYNAMICS (Context-Aware) ---
    if (prices && prices.length >= 3) {
        const first = prices[0];
        const last = prices[prices.length - 1];
        const max = Math.max(...prices);
        const min = Math.min(...prices);

        const isHigher = last > first;

        if (isHigher && last >= max * 0.9995) {
            interval.push({ type: 'bullish', text: 'In Uptrend', time: currentTime, category: 'I' });
        } else if (!isHigher && last <= min * 1.0005) {
            interval.push({ type: 'bearish', text: 'In Downtrend', time: currentTime, category: 'I' });
        } else if (isHigher && last < max * 0.995) {
            interval.push({ type: 'neutral', text: 'Pullback', time: currentTime, category: 'I' });
        } else if (!isHigher && last > min * 1.005) {
            interval.push({ type: 'neutral', text: 'Possible Bounce', time: currentTime, category: 'I' });
        }
    }

    // Deduplicate logic
    const unique = (arr) => {
        const seen = new Set();
        return arr.filter(item => {
            if (seen.has(item.text)) return false;
            seen.add(item.text);
            return true;
        });
    };

    const allLogs = [...unique(session), ...unique(interval)];
    // Sort by time (actually they are added in order, but just to be safe if we had multiple sources)
    // We reverse to get "latest first"
    const sortedLogs = allLogs.reverse();

    return sortedLogs.slice(0, 15);
}

/**
 * Generate Interval-specific alerts based on OHLCV data for the selected interval
 * These are calculated client-side from the coin's interval data
 */
function getIntervalAlerts({ price, open, high, low, rvol, pctChange, squeeze_on, currentInterval }) {
    const alerts = [];
    const p = Number(price);
    const o = Number(open);
    const h = Number(high);
    const l = Number(low);
    const pct = Number(pctChange);
    const vol = Number(rvol);
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    if (!p || !o) return alerts;

    // Price vs Open
    if (p > o) {
        const aboveOpenPct = ((p - o) / o * 100).toFixed(1);
        alerts.push({ icon: '↗', text: `Above Open`, detail: `+${aboveOpenPct}%`, type: 'bullish', time: currentTime });
    } else if (p < o) {
        const belowOpenPct = ((o - p) / o * 100).toFixed(1);
        alerts.push({ icon: '↘', text: `Below Open`, detail: `-${belowOpenPct}%`, type: 'bearish', time: currentTime });
    }

    // Near High/Low
    if (h && p >= h * 0.995) {
        alerts.push({ icon: '📈', text: 'At Interval High', detail: '', type: 'bullish', time: currentTime });
    } else if (h && l && p >= h * 0.98 && p > l) {
        alerts.push({ icon: '🔝', text: 'Near High', detail: `${((h - p) / h * 100).toFixed(1)}% away`, type: 'bullish', time: currentTime });
    }

    if (l && p <= l * 1.005) {
        alerts.push({ icon: '📉', text: 'At Interval Low', detail: '', type: 'bearish', time: currentTime });
    } else if (l && h && p <= l * 1.02 && p < h) {
        alerts.push({ icon: '🔻', text: 'Near Low', detail: `${((p - l) / l * 100).toFixed(1)}% away`, type: 'bearish', time: currentTime });
    }

    // RVOL
    if (vol >= 3) {
        alerts.push({ icon: '🔥', text: 'Very High RVOL', detail: `${vol.toFixed(1)}x`, type: 'bullish', time: currentTime });
    } else if (vol >= 2) {
        alerts.push({ icon: '📊', text: 'High RVOL', detail: `${vol.toFixed(1)}x`, type: 'bullish', time: currentTime });
    } else if (vol < 0.5 && vol > 0) {
        alerts.push({ icon: '⚠️', text: 'Low Volume', detail: `${vol.toFixed(1)}x`, type: 'neutral', time: currentTime });
    }

    // Momentum
    if (pct >= 3) {
        alerts.push({ icon: '🚀', text: 'Strong Up', detail: `+${pct.toFixed(1)}%`, type: 'bullish', time: currentTime });
    } else if (pct >= 1.5) {
        alerts.push({ icon: '💪', text: 'Momentum Up', detail: `+${pct.toFixed(1)}%`, type: 'bullish', time: currentTime });
    } else if (pct <= -3) {
        alerts.push({ icon: '💀', text: 'Strong Down', detail: `${pct.toFixed(1)}%`, type: 'bearish', time: currentTime });
    } else if (pct <= -1.5) {
        alerts.push({ icon: '📉', text: 'Momentum Down', detail: `${pct.toFixed(1)}%`, type: 'bearish', time: currentTime });
    }

    // Squeeze
    if (squeeze_on) {
        alerts.push({ icon: '🔄', text: 'Squeeze On', detail: 'Low volatility', type: 'neutral', time: currentTime });
    }

    return alerts;
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
    style = {},
    // Volatility
    squeeze_on,
    bb_width,
    kc_width,
    vol_atr,
    // NEW: Backend alerts
    alerts = []
}) {
    // DEBUG: Trace alerts data
    console.log('[BubbleTooltip] Alerts received:', symbol, alerts?.length, alerts);

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
    // IMPORTANT: Prioritize day_* specific fields (from API) over generic open/high/low which are interval-based
    const todayOpen = orb?.day_open ?? raw?.day_open ?? raw?.['Open 1 day'] ?? raw?.['day_open'];
    const todayHigh = orb?.day_high ?? raw?.day_high ?? raw?.['High 1 day'] ?? raw?.['day_high'];
    const todayLow = orb?.day_low ?? raw?.day_low ?? raw?.['Low 1 day'] ?? raw?.['day_low'];

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
                {/* Logical Logs Panel (Left Column) */}
                <div className="bt-logs">
                    <div className="bt-log-header">
                        <span>⚡ LIVE ALERTS</span>
                    </div>

                    <div className="bt-log-list">
                        {(() => {
                            // Use backend alerts + supplement with client-side "state" alerts
                            const backendAlerts = alerts || [];

                            // Get client-side state-based alerts (Uptrend, Downtrend, etc.)
                            const stateAlerts = getLogicalLogs({ price, prices, raw, orb, rvol, volatility })
                                .filter(log => log.category === 'I'); // Only interval/state logs

                            const combinedLogs = [...backendAlerts, ...stateAlerts];

                            if (combinedLogs.length === 0) {
                                return <div className="bt-log-empty">No active signals</div>;
                            }

                            return combinedLogs.map((log, i) => (
                                <div key={i} className={`bt-log-item ${log.type}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        {log.time && <span style={{ color: '#64748b', fontWeight: 600, fontSize: '10px', minWidth: '32px' }}>[{log.time}]</span>}
                                        <span className={`bt-log-cat ${log.category === 'D' ? 'session' : 'interval'}`}>
                                            {log.category === 'D' ? 'D' : 'I'}
                                        </span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.text}</span>
                                        {log.category === 'I' && (
                                            <span style={{ fontSize: '12px' }}>
                                                {log.text.includes('Uptrend') && '📈'}
                                                {log.text.includes('Downtrend') && '📉'}
                                                {log.text.includes('Bounce') && '↗️'}
                                                {log.text.includes('Pullback') && '↘️'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Main Content (Center Column) */}
                <div className="bt-main">
                    {/* Header with Symbol and Price */}
                    <div className="bt-header">
                        <div className="bt-symbol-block">
                            <div className="bt-symbol">{symbol || 'N/A'}</div>
                            <div className="bt-name">{name || 'Unknown'}</div>
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

                {/* Sidebar (Right Column) */}
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

                    <div className="bt-sidebar-separator"></div>

                    {/* Volatility Section */}
                    {typeof squeeze_on !== 'undefined' && (
                        <div className="bt-sidebar-section">
                            <div className="bt-sidebar-header">Volatility</div>

                            <div className="bt-stat-row">
                                <span className="bt-stat-label">Status</span>
                                <span className="bt-stat-value" style={{
                                    color: squeeze_on ? '#f97316' : '#10b981',
                                    fontWeight: 'bold'
                                }}>
                                    {squeeze_on ? 'SQUEEZE' : 'NORMAL'}
                                </span>
                            </div>
                            {bb_width != null && (
                                <div className="bt-stat-row">
                                    <span className="bt-stat-label">BB Width</span>
                                    <span className="bt-stat-value">{Number(bb_width).toFixed(4)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Interval Alerts Panel (Right End Column) */}
                <div className="bt-interval-alerts">
                    <div className="bt-log-header">
                        <span>📊 {currentInterval} ALERTS</span>
                    </div>
                    <div className="bt-log-list">
                        {(() => {
                            const intervalAlertsList = getIntervalAlerts({
                                price,
                                open: orb?.open || raw?.open,
                                high: orb?.high || raw?.high,
                                low: orb?.low || raw?.low,
                                rvol,
                                pctChange: intPct,
                                squeeze_on,
                                currentInterval
                            });

                            if (intervalAlertsList.length === 0) {
                                return <div className="bt-log-empty">No interval signals</div>;
                            }

                            return intervalAlertsList.map((alert, i) => (
                                <div key={i} className={`bt-log-item ${alert.type}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: '12px' }}>{alert.icon}</span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.text}</span>
                                        {alert.detail && <span className="bt-int-detail">{alert.detail}</span>}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
