/**
 * Realtime Feature Pusher (TEST MODE ONLY)
 * ---
 * This script simulates market features and pushes them to Redis so the ML
 * inference service can start processing.
 *
 * ⚠️ DO NOT use for trading. This is synthetic data.
 */

const Redis = require("ioredis");

// Allow env override so later you can connect to Railway / remote Redis
const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
});

const SYMBOLS = ["ENGRO", "LUCK", "HBL", "MCB", "OGDC"];

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function buildFeature() {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

    return {
        symbol,
        price: Number(randomBetween(100, 350).toFixed(2)),
        volume: Math.floor(randomBetween(1000, 50000)),
        breakout_score: Number(Math.random().toFixed(4)),
        volatility: Number(randomBetween(0.1, 2.5).toFixed(4)),
        ts: Date.now(),
    };
}

async function pushFeature() {
    const feature = buildFeature();

    try {
        // Push triggers the BLPOP in the Python ML service (if using queue)
        await redis.lpush("ml:inference_queue", JSON.stringify(feature));

        // PUBLISH for RealtimeInference (ticks.raw.*)
        await redis.publish(`ticks.raw.${feature.symbol}`, JSON.stringify(feature));

        console.log(
            `[FeaturePusher] ${feature.symbol} | price=${feature.price} | score=${feature.breakout_score}`
        );
    } catch (err) {
        console.error("Redis push failed:", err.message);
    }
}

// Push every 500ms (matches your plan)
const interval = setInterval(pushFeature, 500);

// Graceful shutdown (important when testing)
process.on("SIGINT", async () => {
    console.log("\nShutting down Feature Pusher...");
    clearInterval(interval);
    await redis.quit();
    process.exit(0);
});

console.log("🚀 Feature Pusher started (TEST DATA MODE)");
