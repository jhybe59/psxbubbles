
import { queryQuestDB } from './server/api/questdb.mjs';

const interval = '15m'; // Test finding baseline for 15m change
const latestTs = new Date().toISOString();
const anchorTs = latestTs;
// const todayOpen = `dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))`; 
const minutesMap = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, 'Day': 0 };
const minutes = 15;
const symbolFilter = '';

// The current slow query logic for baseline
// Scans 7 days at 1m resolution = 10,080 rows per symbol internal scan?
const sqlSlow = `
    WITH baseline_b AS (
      SELECT symbol, timestamp, last(price) as baseline_close
      FROM trades
      WHERE timestamp <= dateadd('m', -${minutes}, '${anchorTs}'::timestamp)
        AND timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp)
        ${symbolFilter.replace('WHERE', 'AND')}
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    baseline_ordered AS (
      SELECT * FROM baseline_b LATEST ON timestamp PARTITION BY symbol
    )
    SELECT * FROM baseline_ordered
`;

// Proposed optimized logic: Just find the last trade
// Uses QuestDB's specialized LATEST ON scan which scans backwards and stops at first match per symbol
const sqlFast = `
    WITH baseline_ordered AS (
      SELECT symbol, timestamp, price as baseline_close
      FROM trades
      WHERE timestamp <= dateadd('m', -${minutes}, '${anchorTs}'::timestamp)
        AND timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp)
        ${symbolFilter.replace('WHERE', 'AND')}
      LATEST ON timestamp PARTITION BY symbol
    )
    SELECT * FROM baseline_ordered
`;

async function bench() {
    try {
        console.log(`Benchmarking Baseline Lookup for ${interval}...`);

        const start1 = performance.now();
        await queryQuestDB(sqlSlow);
        const end1 = performance.now();
        console.log(`Slow Query (SAMPLE BY 1m): ${(end1 - start1).toFixed(2)}ms`);

        const start2 = performance.now();
        await queryQuestDB(sqlFast);
        const end2 = performance.now();
        console.log(`Fast Query (LATEST ON):    ${(end2 - start2).toFixed(2)}ms`);

    } catch (err) {
        console.error('Bench Failed:', err);
    }
}

bench();
