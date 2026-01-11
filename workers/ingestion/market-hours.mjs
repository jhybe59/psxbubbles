import { config } from './config.mjs';
import logger from './logger.mjs';

/**
 * Get current time details in Pakistan Time (PKT) - UTC+5
 */
const getPKTTime = () => {
    // Current UTC time
    const now = new Date();
    // Add 5 hours for PKT
    const pktTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));

    return {
        now, // Original Date object (UTC)
        pktTime, // Date object adjusted to represent PKT as local time
        day: pktTime.getUTCDay(), // 0=Sun, 1=Mon, ..., 6=Sat
        hour: pktTime.getUTCHours(),
        minute: pktTime.getUTCMinutes(),
        dayMinutes: (pktTime.getUTCHours() * 60) + pktTime.getUTCMinutes()
    };
};

/**
 * Check if market is currently open
 * @returns {boolean}
 */
export const isMarketOpen = () => {
    const { day, dayMinutes } = getPKTTime();

    // Weekend Check (Saturday=6, Sunday=0)
    if (day === 0 || day === 6) {
        return false;
    }

    const { marketOpenMinute, marketCloseMinute } = config.worker;
    return dayMinutes >= marketOpenMinute && dayMinutes < marketCloseMinute;
};

/**
 * Get delay in milliseconds until next market open
 * @returns {number} milliseconds
 */
export const getTimeUntilNextOpen = () => {
    const { now, pktTime, day, dayMinutes } = getPKTTime();
    const { marketOpenMinute } = config.worker;

    let daysToAdd = 0;

    if (day === 6) {
        // Saturday -> Monday (add 2 days)
        daysToAdd = 2;
    } else if (day === 0) {
        // Sunday -> Monday (add 1 day)
        daysToAdd = 1;
    } else if (dayMinutes >= marketOpenMinute) {
        // Weekday, but already past open time -> Next day (add 1 day)
        // Note: Use >= so if we are exact on time, we don't wait 24h if we logic calls this
        // But if market is OPEN, this function shouldn't be main driver unless used for close scheduling.
        // If friday afternoon -> Monday (add 3 days)
        if (day === 5) {
            daysToAdd = 3;
        } else {
            daysToAdd = 1;
        }
    } else {
        // Weekday, before open time -> Today (add 0 days)
        daysToAdd = 0;
    }

    // Target is 08:00 AM PKT on the target day
    // We construct target relative to current adjusted PKT time, then convert back diff
    const targetPKT = new Date(pktTime);
    targetPKT.setDate(targetPKT.getDate() + daysToAdd);
    targetPKT.setUTCHours(Math.floor(marketOpenMinute / 60));
    targetPKT.setUTCMinutes(marketOpenMinute % 60);
    targetPKT.setUTCSeconds(0);
    targetPKT.setUTCMilliseconds(0);

    let delay = targetPKT.getTime() - pktTime.getTime();

    // Safety buffer
    if (delay < 0) delay = 1000 * 60; // Should not happen with logic above, but fallback 1 min

    return delay;
};

/**
 * Get delay in milliseconds until current market session closes
 * @returns {number} milliseconds, or 0 if already closed
 */
export const getTimeUntilClose = () => {
    if (!isMarketOpen()) return 0;

    const { pktTime, dayMinutes } = getPKTTime();
    const { marketCloseMinute } = config.worker;

    // Target is today close time
    const targetPKT = new Date(pktTime);
    targetPKT.setUTCHours(Math.floor(marketCloseMinute / 60));
    targetPKT.setUTCMinutes(marketCloseMinute % 60);
    targetPKT.setUTCSeconds(0);
    targetPKT.setUTCMilliseconds(0);

    const delay = targetPKT.getTime() - pktTime.getTime();
    return Math.max(0, delay);
};

export const getMarketStatus = () => {
    const open = isMarketOpen();
    const { day, hour, minute } = getPKTTime();
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];

    return {
        isOpen: open,
        currentTimePKT: `${dayStr} ${timeStr}`,
        nextOpenDelayMs: open ? 0 : getTimeUntilNextOpen(),
        timeUntilCloseMs: open ? getTimeUntilClose() : 0
    };
};
