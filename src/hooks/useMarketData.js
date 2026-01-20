/**
 * useMarketData - Real-time market data via Socket.IO
 * 
 * Connects to backend Socket.IO and listens for market-data events.
 * Each event contains a single symbol's update with ALL interval data.
 * 
 * This hook provides SELECTIVE updates - only the symbol that received
 * a tick will be updated, preserving the position and state of all other bubbles.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { LIVE_API_BASE_URL } from '../config';

export default function useMarketData(onSymbolUpdate) {
    const [connected, setConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const socketRef = useRef(null);
    const updateCountRef = useRef(0);

    // Throttle updates to prevent UI overload (max 10 updates per second per symbol)
    const lastUpdateBySymbol = useRef(new Map());
    const THROTTLE_MS = 100; // 100ms = max 10 updates/sec

    const handleMarketData = useCallback((data) => {
        const { symbol } = data;

        // Throttle check
        const now = Date.now();
        const lastTime = lastUpdateBySymbol.current.get(symbol) || 0;
        if (now - lastTime < THROTTLE_MS) {
            return; // Skip this update (too fast)
        }
        lastUpdateBySymbol.current.set(symbol, now);

        // Update counter
        updateCountRef.current++;
        setLastUpdate({
            symbol,
            time: new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            count: updateCountRef.current
        });

        // Call the update handler
        if (onSymbolUpdate) {
            onSymbolUpdate(data);
        }
    }, [onSymbolUpdate]);

    useEffect(() => {
        // Determine Socket.IO URL
        // For localhost development, we need to connect directly to the API server (port 8080)
        // because Vite's proxy doesn't properly upgrade WebSocket connections
        const origin = typeof window !== 'undefined' ? window.location.origin : '';

        let socketUrl;
        if (LIVE_API_BASE_URL.startsWith('http')) {
            // Production: Use configured URL, strip /api
            socketUrl = LIVE_API_BASE_URL.replace('/api', '');
        } else if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
            // Local development: Connect directly to API server
            socketUrl = 'http://localhost:8080';
        } else {
            // Other environments: Use current origin
            socketUrl = origin;
        }

        console.log('[useMarketData] Connecting to:', socketUrl);

        // Create socket connection
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity, // Always reconnect
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[useMarketData] Connected');
            setConnected(true);
        });

        socket.on('disconnect', (reason) => {
            console.log('[useMarketData] Disconnected:', reason);
            setConnected(false);
        });

        socket.on('market-data', handleMarketData);

        socket.on('connect_error', (err) => {
            console.warn('[useMarketData] Connection error:', err.message);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [handleMarketData]);

    return {
        connected,
        lastUpdate,
        socket: socketRef.current
    };
}
