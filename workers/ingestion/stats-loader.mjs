/**
 * Stats Loader for Real-time Breakout Detection
 * 
 * Fetches daily stats (ORB levels, Daily Open) from QuestDB
 * and feeds them to the breakout detector.
 */
import { queryQuestDB } from './questdb-query.mjs';
import { setORBData } from './breakout-detector.mjs';
import logger from './logger.mjs';

let updateInterval = null;

// Pakistani Market Open: 09:30 PKT = 04:30 UTC
// (Adjust based on actual PSX trading hours, typically 09:30 - 15:30)
const MARKET_OPEN_UTC_HOUR = 4;
const MARKET_OPEN_UTC_MINUTE = 30;

/**
 * Get ORB (Opening Range Breakout) data for all symbols
 * Uses market-wide first tick to determine relative session start
 */
async function fetchORBData() {
    try {
        // Standard SQL way to find today's session start (simplification)
        // In production, we assume session starts after 4:00 AM UTC today
        const marketOpenSql = `
            SELECT MIN(timestamp) as first_tick
            FROM trades
            WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
        `;

        const marketOpenResult = await queryQuestDB(marketOpenSql);

        if (!marketOpenResult || !marketOpenResult.dataset ||
            marketOpenResult.dataset.length === 0 || !marketOpenResult.dataset[0][0]) {
            logger.debug('No trades today yet, skipping ORB fetch');
            return;
        }

        const firstTick = marketOpenResult.dataset[0][0];

        // Fetch ORB levels (5m, 15m, 30m)
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

        if (orbResult && orbResult.dataset) {
            const orbMap = new Map();
            // Columns: symbol, oh5, ol5, oh15, ol15, oh30, ol30
            // Index: 0, 1, 2, 3, 4, 5, 6

            orbResult.dataset.forEach(row => {
                const symbol = row[0];
                if (symbol) {
                    orbMap.set(symbol, {
                        orb_high_5m: row[1],
                        orb_low_5m: row[2],
                        orb_high_15m: row[3],
                        orb_low_15m: row[4],
                        orb_high_30m: row[5],
                        orb_low_30m: row[6]
                    });
                }
            });

            logger.info({ count: orbMap.size }, 'Updated ORB data for breakout detection');
            setORBData(orbMap);
        }

    } catch (err) {
        logger.error({ err }, 'Failed to fetch ORB data');
    }
}

/**
 * Start periodic stats loading
 */
export function startStatsLoader() {
    if (updateInterval) return;

    // Initial fetch
    fetchORBData();

    // Update every 2 minutes
    updateInterval = setInterval(fetchORBData, 2 * 60 * 1000);
    logger.info('Stats loader started');
}

/**
 * Stop stats loading
 */
export function stopStatsLoader() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

export default { startStatsLoader, stopStatsLoader };
