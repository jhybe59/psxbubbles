/**
 * useBreakoutSocket - Real-time breakout alerts via Socket.IO
 * 
 * Connects to backend Socket.IO and listens for breakout events.
 * Returns alerts as they happen in real-time.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

export default function useBreakoutSocket(enabled = true) {
    const [connected, setConnected] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const socketRef = useRef(null);
    const seenAlertsRef = useRef(new Set());

    // Dismiss an alert
    const dismissAlert = useCallback((symbol) => {
        setAlerts(prev => prev.filter(a => a.symbol !== symbol));
    }, []);

    // Clear all alerts
    const clearAlerts = useCallback(() => {
        setAlerts([]);
    }, []);

    useEffect(() => {
        if (!enabled) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setConnected(false);
            return;
        }

        // Use SOCKET_URL from config - handles all environments
        const socketUrl = SOCKET_URL;

        console.log('[useBreakoutSocket] Connecting to:', socketUrl);

        // Create socket connection
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[useBreakoutSocket] Connected');
            setConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('[useBreakoutSocket] Disconnected');
            setConnected(false);
        });

        socket.on('breakout', (alert) => {
            console.log('[useBreakoutSocket] Received breakout alert:', alert);

            // Prevent duplicate alerts (same symbol within 5 min)
            const alertKey = `${alert.symbol}-${Math.floor(alert.timestamp / 300000)}`;
            if (seenAlertsRef.current.has(alertKey)) {
                return;
            }
            seenAlertsRef.current.add(alertKey);

            // Add to alerts (max 10, newest first)
            setAlerts(prev => [alert, ...prev].slice(0, 10));
        });

        socket.on('connect_error', (err) => {
            console.warn('[useBreakoutSocket] Connection error:', err.message);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [enabled]);

    return {
        connected,
        alerts,
        dismissAlert,
        clearAlerts
    };
}
