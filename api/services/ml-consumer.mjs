/**
 * ML Signal Consumer
 * Subscribes to Redis and forwards ML signals to Socket.IO clients.
 * 
 * Redis Channels:
 * - signals.raw.*    - Raw model outputs (for monitoring)
 * - signals.live.*   - Filtered trade signals
 * - signals.ui.*     - UI-optimized feed
 * - market.regime    - Regime changes
 */
import Redis from 'ioredis';
import { Server as SocketServer } from 'socket.io';

class MLSignalConsumer {
    constructor(redisUrl = 'redis://localhost:6379') {
        this.redisUrl = redisUrl;
        this.subscriber = null;
        this.publisher = null;
        this.io = null;

        // Stats
        this.signalsReceived = 0;
        this.signalsBroadcast = 0;
        this.lastSignalTime = {};
    }

    /**
     * Initialize Redis connections
     */
    async connect() {
        this.subscriber = new Redis(this.redisUrl);
        this.publisher = new Redis(this.redisUrl);

        console.log('[ML Consumer] Connected to Redis');

        // Subscribe to ML signal channels
        await this.subscriber.psubscribe(
            'signals.live.*',
            'signals.ui.*',
            'market.regime'
        );

        // Handle messages
        this.subscriber.on('pmessage', (pattern, channel, message) => {
            this._handleMessage(channel, message);
        });

        console.log('[ML Consumer] Subscribed to signal channels');
    }

    /**
     * Attach Socket.IO server for broadcasting
     */
    attachSocketIO(io) {
        this.io = io;
        console.log('[ML Consumer] Socket.IO attached');
    }

    /**
     * Handle incoming Redis message
     */
    _handleMessage(channel, message) {
        try {
            const data = JSON.parse(message);
            this.signalsReceived++;

            if (channel.startsWith('signals.live.')) {
                this._handleLiveSignal(channel, data);
            } else if (channel.startsWith('signals.ui.')) {
                this._handleUISignal(channel, data);
            } else if (channel === 'market.regime') {
                this._handleRegimeChange(data);
            }

        } catch (err) {
            console.error('[ML Consumer] Message parse error:', err.message);
        }
    }

    /**
     * Handle live trade signal
     */
    _handleLiveSignal(channel, data) {
        const symbol = channel.split('.').pop();

        console.log(`[ML Signal] ${symbol}: ${data.action} | conf: ${data.confidence} | regime: ${data.regime}`);

        this.lastSignalTime[symbol] = new Date();

        // Broadcast to Socket.IO
        if (this.io) {
            this.io.emit('ml-signal', {
                type: 'live',
                symbol,
                ...data
            });
            this.signalsBroadcast++;
        }

        // Store in Redis for API access
        this.publisher.setex(
            `ml:signal:${symbol}`,
            300, // 5 min TTL
            JSON.stringify(data)
        );
    }

    /**
     * Handle UI signal (for visualization)
     */
    _handleUISignal(channel, data) {
        const symbol = channel.split('.').pop();

        // Broadcast to Socket.IO (lighter update)
        if (this.io) {
            this.io.emit('ml-update', {
                type: 'ui',
                symbol,
                ...data
            });
        }
    }

    /**
     * Handle regime change
     */
    _handleRegimeChange(data) {
        console.log(`[ML Regime] Market regime: ${data.regime} (${(data.confidence * 100).toFixed(0)}%)`);

        if (this.io) {
            this.io.emit('ml-regime', data);
        }

        // Store current regime
        this.publisher.set('ml:regime:current', JSON.stringify(data));
    }

    /**
     * Get latest signal for symbol
     */
    async getSignal(symbol) {
        const data = await this.publisher.get(`ml:signal:${symbol}`);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Get current regime
     */
    async getCurrentRegime() {
        const data = await this.publisher.get('ml:regime:current');
        return data ? JSON.parse(data) : { regime: 'unknown', confidence: 0 };
    }

    /**
     * Get all recent signals
     */
    async getAllSignals() {
        const keys = await this.publisher.keys('ml:signal:*');
        const signals = {};

        for (const key of keys) {
            const symbol = key.split(':').pop();
            signals[symbol] = await this.getSignal(symbol);
        }

        return signals;
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            signalsReceived: this.signalsReceived,
            signalsBroadcast: this.signalsBroadcast,
            lastSignalTime: this.lastSignalTime
        };
    }

    /**
     * Disconnect
     */
    async disconnect() {
        if (this.subscriber) {
            await this.subscriber.punsubscribe();
            await this.subscriber.quit();
        }
        if (this.publisher) {
            await this.publisher.quit();
        }
        console.log('[ML Consumer] Disconnected');
    }
}

export const mlConsumer = new MLSignalConsumer(process.env.REDIS_URL || 'redis://localhost:6379');
export default MLSignalConsumer;
