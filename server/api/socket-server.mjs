/**
 * Socket.IO Server for Real-time Breakout Alerts
 * 
 * This module creates a Socket.IO server that:
 * 1. Listens for breakout events from Redis pub/sub
 * 2. Broadcasts to all connected frontend clients
 */
import { Server } from 'socket.io';
import { createClient } from 'redis';
import logger from './logger.mjs';
import { config } from './config.mjs';

let io = null;
let redisSubscriber = null;

/**
 * Initialize Socket.IO server on existing HTTP server
 */
export async function initSocketServer(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
        logger.info({ socketId: socket.id }, 'Client connected to Socket.IO');

        socket.on('disconnect', () => {
            logger.info({ socketId: socket.id }, 'Client disconnected from Socket.IO');
        });
    });

    // Subscribe to Redis for breakout alerts from ingestion worker
    try {
        const redisUrl = config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379';
        redisSubscriber = createClient({ url: redisUrl });

        redisSubscriber.on('error', (err) => {
            logger.warn({ err }, 'Redis subscriber error (non-fatal)');
        });

        await redisSubscriber.connect();

        // Subscribe to breakout channel
        await redisSubscriber.subscribe('breakout-alerts', (message) => {
            try {
                const alert = JSON.parse(message);
                logger.info({ symbol: alert.symbol, time: alert.time }, 'Broadcasting breakout alert');
                io.emit('breakout', alert);
            } catch (err) {
                logger.error({ err }, 'Failed to parse breakout alert');
            }
        });

        logger.info('Socket.IO server initialized with Redis pub/sub');
    } catch (err) {
        logger.warn({ err }, 'Redis not available, Socket.IO will work without pub/sub');
    }

    return io;
}

/**
 * Emit breakout alert directly (for local testing without Redis)
 */
export function emitBreakoutAlert(symbol, data) {
    if (io) {
        const alert = {
            symbol,
            price: data.price,
            rvol: data.rvol,
            pct: data.pct,
            time: new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            timestamp: Date.now()
        };
        io.emit('breakout', alert);
        logger.info({ alert }, 'Emitted breakout alert');
    }
}

/**
 * Get Socket.IO instance
 */
export function getIO() {
    return io;
}

export default { initSocketServer, emitBreakoutAlert, getIO };
