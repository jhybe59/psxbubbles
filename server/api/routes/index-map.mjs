/**
 * Index Map endpoint - returns index-to-symbols mapping
 * Used by frontend to filter bubbles by index
 */
import { Router } from 'express';
import { withClient } from '../db.mjs';
import logger from '../logger.mjs';

const router = Router();

/**
 * GET /api/index_map
 * Returns: { [indexCode]: [symbol1, symbol2, ...], ... }
 */
router.get('/', async (req, res) => {
    try {
        const result = await withClient(async (client) => {
            // Get all indices with their member symbols
            const { rows } = await client.query(`
                SELECT 
                    im.index_code,
                    array_agg(im.symbol ORDER BY im.symbol) as symbols
                FROM index_members im
                GROUP BY im.index_code
                ORDER BY im.index_code
            `);
            return rows;
        });

        // Transform to map format { KSE30: ['LUCK', 'OGDC', ...], ... }
        const indexMap = {};
        for (const row of result) {
            indexMap[row.index_code] = row.symbols || [];
        }

        res.set('Cache-Control', 'public, max-age=300');
        res.json(indexMap);
    } catch (err) {
        logger.error({ err }, 'Index map endpoint error');
        res.status(500).json({ error: 'Failed to fetch index map' });
    }
});

export default router;
