import React, { useEffect, useState, useCallback } from 'react';
import './BreakoutToast.css';

/**
 * BreakoutToast - Popup notification for breakout alerts
 * Shows at bottom-right when a symbol triggers breakout conditions
 */
export default function BreakoutToast({ breakouts = [], onDismiss, onViewChart }) {
    const [visible, setVisible] = useState([]);

    useEffect(() => {
        // Add new breakouts to visible list
        const newBreakouts = breakouts.filter(
            b => !visible.some(v => v.symbol === b.symbol)
        );
        if (newBreakouts.length > 0) {
            setVisible(prev => [...newBreakouts, ...prev].slice(0, 5)); // Max 5 toasts
        }
    }, [breakouts]);

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        if (visible.length === 0) return;
        const timer = setTimeout(() => {
            setVisible(prev => prev.slice(0, -1)); // Remove oldest
        }, 15000);
        return () => clearTimeout(timer);
    }, [visible]);

    const handleDismiss = useCallback((symbol) => {
        setVisible(prev => prev.filter(v => v.symbol !== symbol));
        onDismiss?.(symbol);
    }, [onDismiss]);

    const handleViewChart = useCallback((symbol) => {
        onViewChart?.(symbol);
        handleDismiss(symbol);
    }, [onViewChart, handleDismiss]);

    if (visible.length === 0) return null;

    return (
        <div className="breakout-toast-container">
            {visible.map((breakout, index) => (
                <div
                    key={`${breakout.symbol}-${index}`}
                    className="breakout-toast"
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    <div className="toast-header">
                        <span className="toast-icon">🚀</span>
                        <span className="toast-title">BREAKOUT ALERT!</span>
                    </div>

                    <div className="toast-body">
                        <div className="toast-symbol">{breakout.symbol}</div>
                        <div className="toast-price">@ {breakout.price?.toFixed(2)}</div>
                        <div className="toast-meta">
                            <span className="toast-rvol">RVOL: {breakout.rvol?.toFixed(1)}x</span>
                            <span className="toast-pct">+{breakout.pct?.toFixed(2)}%</span>
                        </div>
                    </div>

                    <div className="toast-actions">
                        <button
                            className="toast-btn toast-btn-buy"
                            onClick={() => handleViewChart(breakout.symbol)}
                        >
                            VIEW CHART
                        </button>
                        <button
                            className="toast-btn toast-btn-dismiss"
                            onClick={() => handleDismiss(breakout.symbol)}
                        >
                            DISMISS
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
