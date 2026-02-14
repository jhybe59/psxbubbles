/**
 * ML API Routes
 * Proxies requests to Python ML service and provides signal access.
 */
import express from 'express';
import { mlConsumer } from '../services/ml-consumer.mjs';

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * GET /api/ml/health
 * Check ML service health
 */
router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/health`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(503).json({
            status: 'unavailable',
            error: err.message
        });
    }
});

/**
 * GET /api/ml/signals
 * Get all current ML signals
 */
router.get('/signals', async (req, res) => {
    try {
        const signals = await mlConsumer.getAllSignals();
        res.json({ signals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ml/signals/:symbol
 * Get signal for specific symbol
 */
router.get('/signals/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const signal = await mlConsumer.getSignal(symbol);

        if (!signal) {
            return res.status(404).json({ error: 'No signal for symbol' });
        }

        res.json(signal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ml/regime
 * Get current market regime
 */
router.get('/regime', async (req, res) => {
    try {
        const regime = await mlConsumer.getCurrentRegime();
        res.json(regime);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/ml/infer
 * Request inference for symbol with bar data
 */
router.post('/infer', async (req, res) => {
    try {
        const { symbol, bars, current_position = 0 } = req.body;

        if (!symbol || !bars) {
            return res.status(400).json({ error: 'symbol and bars required' });
        }

        const response = await fetch(`${ML_SERVICE_URL}/infer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, bars, current_position })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ml/models
 * Get model status
 */
router.get('/models', async (req, res) => {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/models`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

/**
 * GET /api/ml/stats
 * Get ML pipeline stats
 */
router.get('/stats', async (req, res) => {
    try {
        // Local consumer stats
        const consumerStats = mlConsumer.getStats();

        // Remote ML service stats
        let serviceStats = null;
        try {
            const response = await fetch(`${ML_SERVICE_URL}/stats`);
            serviceStats = await response.json();
        } catch {
            serviceStats = { error: 'ML service unavailable' };
        }

        res.json({
            consumer: consumerStats,
            service: serviceStats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/ml/realtime/start
 * Start realtime inference for symbols
 */
router.post('/realtime/start', async (req, res) => {
    try {
        const { symbols } = req.body;

        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'symbols array required' });
        }

        const response = await fetch(`${ML_SERVICE_URL}/realtime/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/ml/realtime/stop
 * Stop realtime inference
 */
router.post('/realtime/stop', async (req, res) => {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/realtime/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
