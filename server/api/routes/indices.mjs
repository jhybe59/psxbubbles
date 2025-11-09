import { Router } from 'express';
import { z } from 'zod';
import { withClient } from '../db.mjs';
import { getIndicesSnapshot, getAnalyticsVersion } from '../services/analytics.mjs';

const router = Router();

const schema = z.object({
  includeMembers: z
    .any()
    .transform((value) => value !== undefined)
    .optional()
});

router.get('/', async (req, res, next) => {
  let parsed;
  try {
    parsed = schema.parse(req.query);
  } catch (err) {
    res.status(400).json({ error: { code: 'INVALID_PARAMS', message: err.message } });
    return;
  }

  try {
    const snapshot = await getIndicesSnapshot();
    const baseMeta = await withClient(async (client) => {
      const result = await client.query('SELECT code, description FROM indices');
      return result.rows;
    });
    const metaMap = new Map(baseMeta.map((row) => [row.code, row.description]));
    const rows = snapshot.indices.map((row) => ({
      ...row,
      description: metaMap.get(row.code) ?? null
    }));
    const version = await getAnalyticsVersion();
    if (version) {
      res.set('ETag', version);
    }

    if (!parsed.includeMembers) {
      res.json({ indices: rows });
      return;
    }

    const members = await withClient(async (client) => {
      const result = await client.query('SELECT index_code, symbol FROM index_members ORDER BY index_code, symbol');
      return result.rows;
    });

    const grouped = rows.map((row) => ({
      ...row,
      members: members.filter((m) => m.index_code === row.code).map((m) => m.symbol)
    }));

    res.json({ indices: grouped });
  } catch (err) {
    next(err);
  }
});

export default router;

