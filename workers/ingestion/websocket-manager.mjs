import WebSocket from 'ws';
import { Gauge, Counter } from 'prom-client';
import logger from './logger.mjs';
import { loadSymbols } from './symbols.mjs';
import { initQuestDB, insertMinuteBarsQuest, closeQuestDB } from './questdb.mjs';
import { config } from './config.mjs';
import { addTick } from './tick-buffer.mjs';
import { initBreakoutDetector, checkBreakout } from './breakout-detector.mjs';
import { startStatsLoader, stopStatsLoader } from './stats-loader.mjs';
import { isMarketOpen, getTimeUntilNextOpen, getTimeUntilClose, getMarketStatus } from './market-hours.mjs';

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
        this.lastVolumeMap = new Map();
        this.lastValueMap = new Map();
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
                // Also add to tick buffer for interval tracking
                this.processTick(message.tick);
            } else if (message.type === 'marketData' && message.data) {
                // Handle potential alternative format if any
                this.buffer.push(message.data);
                this.processTick(message.data);
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
                // Write to QuestDB only (fast time-series database)
                try {
                    await insertMinuteBarsQuest(normalised);
                } catch (err) {
                    logger.error({ id: this.id, count: normalised.length, err }, 'Failed to insert batch to QuestDB');
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

            const symbol = tick.s || tick.symbol;

            // Volume Handling: Convert Cumulative to Incremental
            // PSX feed sends 'v' as Total Daily Volume. We need Tick Volume.
            const currentCumulativeVol = Number(tick.v || tick.volume || 0);
            let tradeVolume = 0;

            if (this.lastVolumeMap.has(symbol)) {
                const lastVol = this.lastVolumeMap.get(symbol);
                if (currentCumulativeVol >= lastVol) {
                    tradeVolume = currentCumulativeVol - lastVol;
                } else {
                    // Volume reset (new day or bad data), assume current is new volume
                    tradeVolume = currentCumulativeVol;
                }
            } else {
                // First tick seen this session. 
                // If volume is huge (>10000), it's likely mid-day cumulative. Don't record it as single tick.
                // If it's small, maybe it's fresh. 
                // Safe bet: record 0 for this exact tick to avoid massive spike, but track for next.
                if (currentCumulativeVol > 0) {
                    // Logic: If we just started, we can't claim the entire daily volume happened in this one millisecond.
                    tradeVolume = 0;
                }
            }

            // Update map
            this.lastVolumeMap.set(symbol, currentCumulativeVol);

            // Value/Turnover Handling: Convert Cumulative to Incremental
            const currentCumulativeValue = Number(tick.val || tick.turnover || 0);
            let tradeValue = 0;

            if (this.lastValueMap.has(symbol)) {
                const lastVal = this.lastValueMap.get(symbol);
                if (currentCumulativeValue >= lastVal) {
                    tradeValue = currentCumulativeValue - lastVal;
                } else {
                    tradeValue = currentCumulativeValue;
                }
            } else {
                if (currentCumulativeValue > 0) {
                    tradeValue = 0;
                }
            }
            this.lastValueMap.set(symbol, currentCumulativeValue);

            return {
                symbol: symbol,
                ts: ts,
                // CRITICAL: For minute_bars (tick history), we want the INSTANTANEOUS price state.
                // We do NOT want Day Open/High/Low from the feed, as that makes every row identical for the day.
                // By setting O=H=L=C = Current Price, we record the price at this exact moment.
                // QuestDB aggregation queries will then correctly calculate First(Open), Max(High), Min(Low) over time windows.
                open: Number(tick.c || tick.close || tick.ltp),
                high: Number(tick.c || tick.close || tick.ltp),
                low: Number(tick.c || tick.close || tick.ltp),
                close: Number(tick.c || tick.close || tick.ltp),
                volume: tradeVolume,
                value: tradeValue,
                intervalPct: null, // Calculate if needed
                dailyPct: Number(tick.pch || 0) * 100,
                raw: tick
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * Process tick for tick-based interval tracking
     */
    processTick(tick) {
        try {
            const symbol = tick.s || tick.symbol;
            const price = Number(tick.c || tick.close || tick.ltp);
            const volume = Number(tick.v || tick.volume || 0);
            let ts = Number(tick.t || tick.ts || Date.now());

            // Convert seconds to ms if needed
            if (ts < 10000000000) ts *= 1000;

            if (!symbol || isNaN(price)) return;

            // Add to tick buffer for interval tracking
            const completed = addTick({ symbol, price, volume, ts });

            // Log when any interval completes (for debugging)
            if (completed) {
                const intervals = Object.keys(completed).join(', ');
                logger.debug({ symbol, intervals }, 'Tick interval(s) completed');
            }

            // Check for breakout and emit real-time alert
            checkBreakout(symbol, { price, volume, ts }).catch(() => {
                // Ignore errors silently
            });
        } catch (err) {
            // Silently ignore errors in tick processing
        }
    }

    cleanup() {
        wsConnectionsGauge.dec();
        this.isAlive = false;
        if (this.flushInterval) clearInterval(this.flushInterval);
        stopStatsLoader();
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
        this.shutdownTimeout = null;
        this.wakeupTimeout = null;
    }

    async start() {
        if (this.isRunning) return;

        // Market Hours Check
        const status = getMarketStatus();
        logger.info({ status }, 'Checking market status on startup');

        if (!status.isOpen) {
            const delay = status.nextOpenDelayMs;
            const hours = (delay / (1000 * 60 * 60)).toFixed(1);
            logger.info({ delayMs: delay, hours }, 'Market is CLOSED. Scheduling wakeup.');

            this.scheduleWakeup(delay);
            return;
        }

        this.isRunning = true;

        // Schedule shutdown at market close
        const timeUntilClose = getTimeUntilClose();
        if (timeUntilClose > 0) {
            logger.info({
                timeUntilCloseMs: timeUntilClose,
                hours: (timeUntilClose / (1000 * 60 * 60)).toFixed(1)
            }, 'Scheduling auto-disconnect at market close');

            this.shutdownTimeout = setTimeout(() => {
                logger.info('Market closing time reached. Stopping worker...');
                this.stop(true); // true = schedule wakeup
            }, timeUntilClose);
        }

        // Initialize QuestDB sender
        await initQuestDB();

        // Initialize breakout detector for real-time alerts
        await initBreakoutDetector();

        // Start stats loader (fetches ORB data)
        startStatsLoader();

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

    async stop(scheduleNext = false) {
        this.isRunning = false;

        // Clear timers
        if (this.shutdownTimeout) clearTimeout(this.shutdownTimeout);
        if (this.wakeupTimeout) clearTimeout(this.wakeupTimeout);

        this.connections.forEach(conn => conn.close());
        this.connections = [];

        // Close QuestDB sender
        await closeQuestDB();

        if (scheduleNext) {
            const delay = getTimeUntilNextOpen();
            logger.info({ delayMs: delay }, 'Worker stopped. Scheduling wakeup for next market open.');
            this.scheduleWakeup(delay);
        }
    }

    scheduleWakeup(delay) {
        if (this.wakeupTimeout) clearTimeout(this.wakeupTimeout);

        // Max timeout in JS is 24.8 days, so we are safe
        this.wakeupTimeout = setTimeout(() => {
            logger.info('Wakeup time reached. Starting worker...');
            this.start();
        }, delay);
    }
}

export default new WebSocketManager();
