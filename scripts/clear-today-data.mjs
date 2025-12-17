#!/usr/bin/env node
/**
 * Clear Today's Data from QuestDB
 * 
 * This script deletes all data from today to start fresh.
 * Run this on Railway via API service's "Run Command" feature.
 * 
 * Usage: node scripts/clear-today-data.mjs
 */

import 'dotenv/config';

const QUESTDB_HOST = process.env.QUESTDB_HOST || 'localhost';
const QUESTDB_HTTP_PORT = process.env.QUESTDB_HTTP_PORT || 9000;
const QUESTDB_URL = `http://${QUESTDB_HOST}:${QUESTDB_HTTP_PORT}`;

async function executeQuery(sql) {
    const url = `${QUESTDB_URL}/exec?query=${encodeURIComponent(sql)}`;
    console.log(`Executing: ${sql}`);

    try {
        const response = await fetch(url);
        const result = await response.json();

        if (result.error) {
            console.error(`Error: ${result.error}`);
            return false;
        }

        console.log(`Success! Affected rows: ${result.count || 'N/A'}`);
        return true;
    } catch (error) {
        console.error(`Failed: ${error.message}`);
        return false;
    }
}

export async function clearTodayData() {
    console.log('='.repeat(50));
    console.log('CLEAR TODAY\'S DATA FROM QUESTDB');
    console.log('='.repeat(50));
    console.log(`QuestDB URL: ${QUESTDB_URL}`);

    // Get today's date in UTC
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // e.g., "2025-12-16"
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    console.log(`\nDeleting data from: ${todayStr} to ${tomorrowStr}`);
    console.log('-'.repeat(50));

    // Check current data count
    console.log('\n📊 Current data count for today:');
    await executeQuery(`SELECT count() FROM snapshots WHERE ts >= '${todayStr}' AND ts < '${tomorrowStr}'`);

    // Delete from snapshots table
    console.log('\n🗑️ Deleting from snapshots table...');
    await executeQuery(`DELETE FROM snapshots WHERE ts >= '${todayStr}T00:00:00.000000Z' AND ts < '${tomorrowStr}T00:00:00.000000Z'`);

    // Delete from trades table (if exists)
    console.log('\n🗑️ Deleting from trades table...');
    await executeQuery(`DELETE FROM trades WHERE ts >= '${todayStr}T00:00:00.000000Z' AND ts < '${tomorrowStr}T00:00:00.000000Z'`);

    // Verify deletion
    console.log('\n✅ Verification - remaining data for today:');
    await executeQuery(`SELECT count() FROM snapshots WHERE ts >= '${todayStr}' AND ts < '${tomorrowStr}'`);

    console.log('\n' + '='.repeat(50));
    console.log('DONE! Today\'s data has been cleared.');
    console.log('Fresh data will start collecting tomorrow.');
    console.log('='.repeat(50));
    return true;
}

// Check if file is being run directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    clearTodayData().catch(console.error);
}
