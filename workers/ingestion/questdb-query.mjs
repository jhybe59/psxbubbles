/**
 * QuestDB HTTP Client for querying time-series data
 * (Worker version - for reading stats)
 */
import { config } from './config.mjs';
import logger from './logger.mjs';

const QUESTDB_BASE_URL = `http://${config.questdb?.host || 'localhost'}:${config.questdb?.httpPort || 9000}`;

/**
 * Execute a SQL query against QuestDB
 * @param {string} sql - SQL query to execute
 * @returns {Promise<{columns: Array, dataset: Array}>}
 */
export async function queryQuestDB(sql) {
    const url = `${QUESTDB_BASE_URL}/exec?query=${encodeURIComponent(sql)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const result = await response.json();

        // Handle table not exists error gracefully (returns empty data)
        if (result.error && result.error.includes('table does not exist')) {
            return { columns: [], dataset: [] };
        }

        if (result.error) {
            throw new Error(`QuestDB query failed: ${result.error}`);
        }

        return result;
    } catch (err) {
        logger.error({ err, sql: sql.substring(0, 100) }, 'QuestDB query error');
        throw err;
    }
}

export default {
    queryQuestDB
};
