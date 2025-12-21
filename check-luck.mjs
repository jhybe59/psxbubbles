
import { queryQuestDB } from './server/api/questdb.mjs';

async function checkData() {
    const res = await queryQuestDB("SELECT * FROM minute_bars WHERE symbol='LUCK' AND timestamp < '2025-12-18T04:00:00' LIMIT 5");
    console.log(JSON.stringify(res.dataset, null, 2));

    const countRes = await queryQuestDB("SELECT count() FROM minute_bars WHERE symbol='LUCK'");
    console.log('Total LUCK rows:', countRes.dataset[0][0]);

    const maxTsRes = await queryQuestDB("SELECT max(timestamp) FROM minute_bars WHERE symbol='LUCK'");
    console.log('Max LUCK TS:', maxTsRes.dataset[0][0]);

    const minTsRes = await queryQuestDB("SELECT min(timestamp) FROM minute_bars WHERE symbol='LUCK'");
    console.log('Min LUCK TS:', minTsRes.dataset[0][0]);
}

checkData();
