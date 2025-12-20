/**
 * Tick-based bubbles endpoint
 * Returns bubble data using last N rows from QuestDB
 * 
 * OPTIMIZED: Single query instead of per-symbol queries
 */
import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';
import rvolService from '../services/rvol-service.mjs';
import { volatilityService } from '../services/volatility-service.mjs';

const router = Router();

const TICK_INTERVALS = [10, 20, 50, 100, 500, 1000];

const schema = z.object({
    ticks: z.coerce.number().int().refine(val => TICK_INTERVALS.includes(val), {
        message: `ticks must be one of: ${TICK_INTERVALS.join(', ')}`
    }).optional(),
});

/**
 * Get ORB (Opening Range Breakout) data for all symbols
 * Uses market-wide first tick as ORB start time
 * Returns ORB high/low for 5m, 15m, 30m windows
 */
async function getORBData() {
    try {
        // Step 1: Get market-wide first tick of the trading day
        // Pakistan trading day starts at 09:00 PKT = 04:00 UTC
        // We find today's first tick after 04:00 UTC
        const marketOpenSql = `
            SELECT MIN(timestamp) as first_tick
            FROM trades
            WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
        `;

        const marketOpenResult = await queryQuestDB(marketOpenSql);

        if (!marketOpenResult || !marketOpenResult.dataset ||
            marketOpenResult.dataset.length === 0 || !marketOpenResult.dataset[0][0]) {
            return new Map(); // No trades today
        }

        const firstTick = marketOpenResult.dataset[0][0];

        // Step 2: Calculate ORB for all windows (5m, 15m, 30m) in one query
        const orbSql = `
            SELECT 
                symbol,
                MAX(CASE WHEN timestamp < dateadd('m', 5, '${firstTick}') THEN price END) as orb_high_5m,
                MIN(CASE WHEN timestamp < dateadd('m', 5, '${firstTick}') THEN price END) as orb_low_5m,
                MAX(CASE WHEN timestamp < dateadd('m', 15, '${firstTick}') THEN price END) as orb_high_15m,
                MIN(CASE WHEN timestamp < dateadd('m', 15, '${firstTick}') THEN price END) as orb_low_15m,
                MAX(CASE WHEN timestamp < dateadd('m', 30, '${firstTick}') THEN price END) as orb_high_30m,
                MIN(CASE WHEN timestamp < dateadd('m', 30, '${firstTick}') THEN price END) as orb_low_30m
            FROM trades
            WHERE timestamp >= '${firstTick}'
                AND timestamp < dateadd('m', 30, '${firstTick}')
            GROUP BY symbol
        `;

        const orbResult = await queryQuestDB(orbSql);

        if (!orbResult || !orbResult.dataset) {
            return new Map();
        }

        // Build ORB map by symbol
        const orbMap = new Map();
        const columns = orbResult.columns || [];
        const colIndex = {};
        columns.forEach((col, idx) => {
            colIndex[col.name] = idx;
        });

        for (const row of orbResult.dataset) {
            const symbol = row[colIndex['symbol']];
            orbMap.set(symbol, {
                orb_high_5m: parseFloat(row[colIndex['orb_high_5m']]) || null,
                orb_low_5m: parseFloat(row[colIndex['orb_low_5m']]) || null,
                orb_high_15m: parseFloat(row[colIndex['orb_high_15m']]) || null,
                orb_low_15m: parseFloat(row[colIndex['orb_low_15m']]) || null,
                orb_high_30m: parseFloat(row[colIndex['orb_high_30m']]) || null,
                orb_low_30m: parseFloat(row[colIndex['orb_low_30m']]) || null
            });
        }

        logger.debug({ count: orbMap.size, firstTick }, 'ORB data calculated for tick-bubbles');
        return orbMap;
    } catch (err) {
        logger.warn({ err }, 'Failed to calculate ORB data for tick-bubbles');
        return new Map();
    }
}

/**
 * GET /api/tick-bubbles
 * 
 * Gets the last N*100 rows (for ~100 symbols), then calculates OHLCV per symbol in JS
 * This is much faster than 100 separate queries
 */
router.get('/', async (req, res) => {
    const start = Date.now();

    try {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid parameters',
                details: parsed.error.errors,
                validIntervals: TICK_INTERVALS
            });
        }

        const tickCount = parsed.data.ticks || 100;

        // Get recent data - enough rows for all symbols
        // For 100 symbols * 1000 ticks = 100,000 rows max
        const limit = Math.min(tickCount * 150, 150000);

        const sql = `
            SELECT symbol, price, volume, timestamp 
            FROM trades 
            ORDER BY timestamp DESC 
            LIMIT ${limit}
        `;

        const result = await queryQuestDB(sql);

        if (!result || !result.dataset || result.dataset.length === 0) {
            return res.json([]);
        }

        // Group by symbol and take last N ticks for each
        const symbolData = new Map();

        for (const row of result.dataset) {
            const symbol = row[0];
            const close = parseFloat(row[1]) || 0; // price is now in column 1
            const volume = parseFloat(row[2]) || 0;
            const ts = row[3];

            if (!symbolData.has(symbol)) {
                symbolData.set(symbol, []);
            }

            const ticks = symbolData.get(symbol);
            if (ticks.length < tickCount) {
                ticks.push({ close, volume, ts });
            }
        }

        // Calculate OHLCV for each symbol
        const bubbles = [];

        // Fetch 24h stats for all symbols
        // daily_pct comes from minute_bars (efficient LATEST ON)
        // day_volume comes from trades (SUM from start of day) per user request
        let dayStats = new Map();
        try {
            // Get daily_pct from minute_bars
            const pctSql = `
                SELECT symbol, daily_pct
                FROM minute_bars
                LATEST ON timestamp PARTITION BY symbol
            `;
            const pctResult = await queryQuestDB(pctSql);
            if (pctResult && pctResult.dataset) {
                for (const row of pctResult.dataset) {
                    const sym = row[0];
                    const pct = parseFloat(row[1]) || 0;
                    if (!dayStats.has(sym)) dayStats.set(sym, { pct_24h: 0, day_volume: 0, prev_close: null });
                    dayStats.get(sym).pct_24h = pct;
                }
            }

            // Get prev_close from minute_bars (last close before today's session)
            const prevCloseSql = `
                SELECT symbol, last(close) as prev_close
                FROM minute_bars
                WHERE timestamp < dateadd('h', 4, date_trunc('day', now()))
                GROUP BY symbol
            `;
            const prevCloseResult = await queryQuestDB(prevCloseSql);
            if (prevCloseResult && prevCloseResult.dataset) {
                for (const row of prevCloseResult.dataset) {
                    const sym = row[0];
                    const pc = parseFloat(row[1]) || null;
                    if (!dayStats.has(sym)) dayStats.set(sym, { pct_24h: 0, day_volume: 0, prev_close: null });
                    dayStats.get(sym).prev_close = pc;
                }
            }

            // Get day_volume, day_high, day_low from trades (raw session data)
            const volHighLowSql = `
                SELECT 
                    symbol, 
                    sum(volume) as day_volume,
                    max(price) as day_high,
                    min(price) as day_low
                FROM trades
                WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
                GROUP BY symbol
            `;
            const volResult = await queryQuestDB(volHighLowSql);
            if (volResult && volResult.dataset) {
                for (const row of volResult.dataset) {
                    const sym = row[0];
                    const vol = parseFloat(row[1]) || 0;
                    const high = parseFloat(row[2]) || 0;
                    const low = parseFloat(row[3]) || 0;
                    if (!dayStats.has(sym)) dayStats.set(sym, { pct_24h: 0, day_volume: 0, prev_close: null, day_high: 0, day_low: 0 });
                    const ds = dayStats.get(sym);
                    ds.day_volume = vol;
                    ds.day_high = high;
                    ds.day_low = low;
                }
            }
        } catch (e) {
            logger.warn({ err: e }, 'Failed to fetch day stats for tick bubbles');
        }

        for (const [symbol, ticks] of symbolData.entries()) {
            if (ticks.length === 0) continue;

            // Ticks are in DESC order (newest first)
            const prices = ticks.map(t => t.close);
            const volumes = ticks.map(t => t.volume);

            const closePrice = prices[0]; // newest
            const openPrice = prices[prices.length - 1]; // oldest
            const high = Math.max(...prices);
            const low = Math.min(...prices);
            const volume = Math.max(...volumes) - Math.min(...volumes);

            const pctChange = openPrice !== 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0;

            const endTs = ticks[0].ts;
            const startTs = ticks[ticks.length - 1].ts;
            const timeElapsedMs = new Date(endTs).getTime() - new Date(startTs).getTime();

            // Get day stats
            const ds = dayStats.get(symbol) || { pct_24h: 0, day_volume: 0, prev_close: null };

            // For pct_24h, if we have prev_close, calculate it more accurately to match terminal
            let finalPct24h = ds.pct_24h;
            if (ds.prev_close) {
                finalPct24h = ((closePrice - ds.prev_close) / ds.prev_close) * 100;
            }

            bubbles.push({
                symbol,
                price: closePrice,
                open: openPrice,
                high,
                low,
                close: closePrice,
                volume,
                pct_24h: finalPct24h,
                day_volume: ds.day_volume,
                pct_interval: pctChange,
                interval: `${tickCount}_ticks`,
                timeElapsedMs,
                ts: endTs,
                startTs,
                tickCount: ticks.length,
                hasEnoughTicks: ticks.length >= tickCount,
                availableTicks: ticks.length,
                prev_close: ds.prev_close,
                day_high: ds.day_high,
                day_low: ds.day_low
            });
        }

        // Fetch ORB data and merge with tick bubbles
        try {
            const orbMap = await getORBData();

            if (orbMap.size > 0) {
                for (const bubble of bubbles) {
                    const orbData = orbMap.get(bubble.symbol);
                    if (orbData) {
                        // Add ORB values
                        bubble.orb_high_5m = orbData.orb_high_5m;
                        bubble.orb_low_5m = orbData.orb_low_5m;
                        bubble.orb_high_15m = orbData.orb_high_15m;
                        bubble.orb_low_15m = orbData.orb_low_15m;
                        bubble.orb_high_30m = orbData.orb_high_30m;
                        bubble.orb_low_30m = orbData.orb_low_30m;

                        // Calculate breakout status for each window
                        const price = bubble.price;

                        // 5m breakout
                        if (orbData.orb_high_5m && price > orbData.orb_high_5m) {
                            bubble.orb_breakout_5m = 'above';
                        } else if (orbData.orb_low_5m && price < orbData.orb_low_5m) {
                            bubble.orb_breakout_5m = 'below';
                        } else {
                            bubble.orb_breakout_5m = 'inside';
                        }

                        // 15m breakout
                        if (orbData.orb_high_15m && price > orbData.orb_high_15m) {
                            bubble.orb_breakout_15m = 'above';
                        } else if (orbData.orb_low_15m && price < orbData.orb_low_15m) {
                            bubble.orb_breakout_15m = 'below';
                        } else {
                            bubble.orb_breakout_15m = 'inside';
                        }

                        // 30m breakout
                        if (orbData.orb_high_30m && price > orbData.orb_high_30m) {
                            bubble.orb_breakout_30m = 'above';
                        } else if (orbData.orb_low_30m && price < orbData.orb_low_30m) {
                            bubble.orb_breakout_30m = 'below';
                        } else {
                            bubble.orb_breakout_30m = 'inside';
                        }
                    }
                }
            }
        } catch (orbErr) {
            logger.warn({ err: orbErr }, 'Failed to merge ORB data into tick bubbles (non-fatal)');
        }

        // Fetch and merge Tick-based RVOL data
        try {
            const symbolsList = bubbles.map(b => b.symbol);
            console.log(`[tick-bubbles] Fetching RVOL for ${symbolsList.length} symbols, ticks=${tickCount}`);
            const rvolMap = await rvolService.getBatchTickRVOL(symbolsList, tickCount, 20);
            console.log(`[tick-bubbles] RVOL Map size: ${rvolMap.size}`);
            if (rvolMap.size > 0) {
                const sampleKey = symbolsList[0];
                console.log(`[tick-bubbles] Sample RVOL for ${sampleKey}: ${rvolMap.get(sampleKey)}`);
            }

            for (const bubble of bubbles) {
                bubble.rvol = rvolMap.get(bubble.symbol) || 0;
            }
        } catch (rvolErr) {
            console.error('[tick-bubbles] Failed to merge tick RVOL data:', rvolErr);
        }

        // Fetch and merge Tick-based Volatility (Squeeze) data
        try {
            const symbolsList = bubbles.map(b => b.symbol);
            const squeezeMap = await volatilityService.getBatchTickSqueeze(symbolsList, tickCount);

            for (const bubble of bubbles) {
                const volData = squeezeMap.get(bubble.symbol);
                if (volData) {
                    bubble.squeeze_on = volData.squeeze_on;
                    bubble.bb_width = volData.bb_width;
                    bubble.kc_width = volData.kc_width;
                    bubble.vol_atr = volData.atr;
                    bubble.vol_atr_pct = volData.vol_atr_pct;
                    bubble.vol_stddev = volData.stddev;
                }
            }
        } catch (volErr) {
            console.error('[tick-bubbles] Failed to merge tick volatility data:', volErr);
        }

        const duration = Date.now() - start;
        logger.info({ duration, count: bubbles.length, ticks: tickCount }, 'Tick bubbles query');

        res.json(bubbles);
    } catch (err) {
        logger.error({ err }, 'Tick bubbles endpoint error');
        res.status(500).json({ error: 'Failed to fetch tick bubble data' });
    }
});

/**
 * GET /api/tick-bubbles/status
 */
router.get('/status', async (req, res) => {
    try {
        const countSql = `SELECT count(*) as total, count_distinct(symbol) as symbols FROM trades`;
        const result = await queryQuestDB(countSql);

        let totalRows = 0;
        let totalSymbols = 0;

        if (result && result.dataset && result.dataset[0]) {
            totalRows = parseInt(result.dataset[0][0]) || 0;
            totalSymbols = parseInt(result.dataset[0][1]) || 0;
        }

        res.json({
            summary: {
                source: 'QuestDB',
                totalRows,
                totalSymbols,
                intervals: TICK_INTERVALS,
                avgTicksPerSymbol: totalSymbols > 0 ? Math.round(totalRows / totalSymbols) : 0
            }
        });
    } catch (err) {
        logger.error({ err }, 'Tick status endpoint error');
        res.status(500).json({ error: 'Failed to get tick status' });
    }
});

export default router;
