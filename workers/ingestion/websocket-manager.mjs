import WebSocket from 'ws';
import { Gauge, Counter } from 'prom-client';
import logger from './logger.mjs';
import { loadSymbols } from './symbols.mjs';
import { insertMinuteBars } from './timescale.mjs';
import { config } from './config.mjs';

const wsConnectionsGauge = new Gauge({
    name: 'ingestion_ws_connections_active',
    help: 'Number of active WebSocket connections'
});

const wsMessagesCounter = new Counter({
    name: 'ingestion_ws_messages_total',
    help: 'Total WebSocket messages received',
    labelNames: ['type']
});

class WebSocketConnection {
    constructor(id, symbols) {
        this.id = id;
        this.symbols = symbols;
        this.ws = null;
        this.pingInterval = null;
        this.reconnectTimeout = null;
        this.isAlive = false;
        this.buffer = [];
        this.flushInterval = null;
    }

    connect() {
        if (this.ws) return;

        logger.info({ id: this.id, symbolsCount: this.symbols.length }, 'Connecting WebSocket');
        this.ws = new WebSocket(config.psxApi.wsUrl);

        this.ws.on('open', () => {
            logger.info({ id: this.id }, 'WebSocket connected');
            wsConnectionsGauge.inc();
            this.isAlive = true;
            this.subscribe();
            this.startFlushLoop();
        });

        this.ws.on('message', (data) => this.handleMessage(data));

        this.ws.on('close', () => {
            logger.warn({ id: this.id }, 'WebSocket closed');
            this.cleanup();
            this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
            logger.error({ id: this.id, err }, 'WebSocket error');
        });
    }

    subscribe() {
        // Subscribe to each symbol individually
        // The API doesn't support comma-separated symbols
        // Each connection can handle 20 subscriptions
        this.symbols.forEach((symbol, index) => {
            const msg = {
                type: "subscribe",
                subscriptionType: "marketData",
                params: {
                    marketType: "REG",
                    symbol: symbol
                },
                requestId: `req-${this.id}-${symbol}`
            };
            this.send(msg);
        });
        logger.info({ id: this.id, count: this.symbols.length, symbols: this.symbols }, 'Sent individual subscriptions for symbols');
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'ping') {
                logger.info({ id: this.id, timestamp: message.timestamp }, 'Received ping, sending pong');
                this.send({ type: 'pong', timestamp: message.timestamp });
                return;
            }

            // Log everything else to debug subscription
            if (message.type !== 'tickUpdate' && message.type !== 'marketData') {
                logger.info({ id: this.id, type: message.type, msg: message }, 'Received WebSocket message');
            }

            wsMessagesCounter.inc({ type: message.type || 'unknown' });

            if (message.type === 'tickUpdate' && message.tick) {
                this.buffer.push(message.tick);
            } else if (message.type === 'marketData' && message.data) {
                // Handle potential alternative format if any
                this.buffer.push(message.data);
            }

        } catch (err) {
            logger.error({ id: this.id, err }, 'Failed to parse message');
        }
    }

    startFlushLoop() {
        if (this.flushInterval) clearInterval(this.flushInterval);
        this.flushInterval = setInterval(async () => {
            if (this.buffer.length === 0) return;

            const batch = this.buffer.splice(0, this.buffer.length);
            const normalised = batch.map(row => this.normalise(row)).filter(Boolean);

            if (normalised.length) {
                try {
                    await insertMinuteBars(normalised);
                } catch (err) {
                    logger.error({ id: this.id, count: normalised.length, err }, 'Failed to insert batch');
                }
            }
        }, 1000); // Flush every second
    }

    normalise(tick) {
        // Map tick format to our internal format
        // Tick format from user sample:
        // { s: 'AIRLINK', t: 1750762129000, c: 143.05, ... }

        try {
            let ts = Number(tick.t || tick.ts || Date.now());
            // If timestamp is in seconds (10 digits), convert to ms
            if (ts < 10000000000) {
                ts *= 1000;
            }

            return {
                symbol: tick.s || tick.symbol,
                ts: ts,
                open: Number(tick.o || tick.open || tick.c || tick.close), // Fallback to close if open missing in update
                high: Number(tick.h || tick.high || tick.c || tick.close),
                low: Number(tick.l || tick.low || tick.c || tick.close),
                close: Number(tick.c || tick.close),
                volume: Number(tick.v || tick.volume || 0),
                turnover: Number(tick.val || tick.turnover || 0),
                intervalPct: null, // Calculate if needed
                dailyPct: Number(tick.pch || 0) * 100,
                raw: tick
            };
        } catch (err) {
            return null;
        }
    }

    cleanup() {
        wsConnectionsGauge.dec();
        this.isAlive = false;
        if (this.flushInterval) clearInterval(this.flushInterval);
        this.ws = null;
    }

    scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }

    close() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.flushInterval) clearInterval(this.flushInterval);
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
        }
    }
}

export class WebSocketManager {
    constructor() {
        this.connections = [];
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        const symbols = await loadSymbols();
        const chunkSize = 20;

        // Split symbols into chunks
        for (let i = 0; i < symbols.length; i += chunkSize) {
            const chunk = symbols.slice(i, i + chunkSize);
            const connection = new WebSocketConnection(i / chunkSize, chunk);
            this.connections.push(connection);
            connection.connect();

            // Stagger connections slightly to avoid thundering herd
            await new Promise(r => setTimeout(r, 500));
        }

        logger.info({ totalConnections: this.connections.length }, 'WebSocket Manager started');
    }

    async stop() {
        this.isRunning = false;
        this.connections.forEach(conn => conn.close());
        this.connections = [];
    }
}

export default new WebSocketManager();
