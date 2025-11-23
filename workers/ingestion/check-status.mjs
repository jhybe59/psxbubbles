/**
 * Check Ingestion Worker Status
 * 
 * Reports:
 * 1. Worker running status
 * 2. Last processed job timestamp
 * 3. Next scheduled job
 * 4. Job failures or skips
 */

import { fetchQueue } from './queue.mjs';
import { config } from './config.mjs';
import logger from './logger.mjs';

// Allow script to run even if some config vars are missing
process.env.PSX_API_TOKEN = process.env.PSX_API_TOKEN || '';
process.env.PSX_API_BATCH_SIZE = process.env.PSX_API_BATCH_SIZE || '80';

const JOB_NAME = 'poll-minute-bars';

/**
 * Format timestamp to readable string
 */
const formatTimestamp = (ts) => {
  if (!ts) return 'N/A';
  if (typeof ts === 'number') {
    return new Date(ts).toISOString();
  }
  return ts instanceof Date ? ts.toISOString() : String(ts);
};

/**
 * Format duration in human-readable format
 */
const formatDuration = (ms) => {
  if (!ms || ms < 0) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Get worker status report
 */
const getWorkerStatus = async () => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 INGESTION WORKER STATUS CHECK');
    console.log('='.repeat(60) + '\n');

    // 1. Check if repeatable job exists
    console.log('1️⃣  REPEATABLE JOB STATUS');
    console.log('-'.repeat(60));
    
    const repeatableJobs = await fetchQueue.getRepeatableJobs();
    const scheduledJob = repeatableJobs.find((job) => job.name === JOB_NAME);

    if (!scheduledJob) {
      console.log('❌ No repeatable job found with name:', JOB_NAME);
      console.log('   Worker may not be running or not started yet.\n');
    } else {
      console.log('✅ Repeatable job found:');
      console.log(`   Name: ${scheduledJob.name}`);
      console.log(`   ID: ${scheduledJob.id}`);
      console.log(`   Cron: ${scheduledJob.cron || scheduledJob.pattern || 'N/A'}`);
      console.log(`   Next Run: ${formatTimestamp(scheduledJob.next)}`);
      console.log(`   Timezone: ${scheduledJob.tz || 'UTC'}`);
      console.log(`   Key: ${scheduledJob.key}`);
      
      if (scheduledJob.next) {
        const nextRun = new Date(scheduledJob.next);
        const now = new Date();
        const timeUntilNext = nextRun - now;
        console.log(`   ⏰ Time until next run: ${formatDuration(timeUntilNext)}`);
      }
      console.log('');
    }

    // 2. Check queue stats
    console.log('2️⃣  QUEUE STATS');
    console.log('-'.repeat(60));
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      fetchQueue.getWaiting(),
      fetchQueue.getActive(),
      fetchQueue.getCompleted(0, 10), // Last 10 completed
      fetchQueue.getFailed(0, 10),    // Last 10 failed
      fetchQueue.getDelayed()
    ]);

    console.log(`   Waiting: ${waiting.length}`);
    console.log(`   Active: ${active.length}`);
    console.log(`   Delayed: ${delayed.length}`);
    console.log(`   Completed (last 10): ${completed.length}`);
    console.log(`   Failed (last 10): ${failed.length}`);
    console.log('');

    // 3. Last processed job timestamp
    console.log('3️⃣  LAST PROCESSED JOB');
    console.log('-'.repeat(60));
    
    if (completed.length > 0) {
      const lastCompleted = completed[0];
      console.log('✅ Last completed job:');
      console.log(`   Job ID: ${lastCompleted.id}`);
      console.log(`   Completed At: ${formatTimestamp(lastCompleted.finishedOn)}`);
      console.log(`   Processed At: ${formatTimestamp(lastCompleted.processedOn)}`);
      console.log(`   Duration: ${formatDuration(lastCompleted.finishedOn - lastCompleted.processedOn)}`);
      
      const lastCompletedTime = new Date(lastCompleted.finishedOn);
      const now = new Date();
      const timeSinceLast = now - lastCompletedTime;
      console.log(`   ⏱️  Time since last job: ${formatDuration(timeSinceLast)}`);
      
      // Check if worker seems stuck (more than 5 minutes since last completion)
      if (timeSinceLast > 5 * 60 * 1000 && scheduledJob?.next) {
        const nextRun = new Date(scheduledJob.next);
        if (now < nextRun) {
          console.log(`   ⚠️  Warning: Last job completed ${formatDuration(timeSinceLast)} ago, but next scheduled run is in future`);
        }
      }
    } else {
      console.log('❌ No completed jobs found');
      console.log('   Worker may not have processed any jobs yet.\n');
    }
    console.log('');

    // 4. Active jobs (currently running)
    console.log('4️⃣  ACTIVE JOBS (Currently Running)');
    console.log('-'.repeat(60));
    
    if (active.length > 0) {
      active.forEach((job, index) => {
        console.log(`   Job ${index + 1}:`);
        console.log(`      ID: ${job.id}`);
        console.log(`      Started: ${formatTimestamp(job.processedOn)}`);
        if (job.processedOn) {
          const now = new Date();
          const duration = now - new Date(job.processedOn);
          console.log(`      Running for: ${formatDuration(duration)}`);
        }
      });
    } else {
      console.log('   ℹ️  No active jobs (worker idle)');
    }
    console.log('');

    // 5. Failed jobs
    console.log('5️⃣  FAILED JOBS (Last 10)');
    console.log('-'.repeat(60));
    
    if (failed.length > 0) {
      failed.forEach((job, index) => {
        console.log(`   ❌ Failed Job ${index + 1}:`);
        console.log(`      ID: ${job.id}`);
        console.log(`      Failed At: ${formatTimestamp(job.failedReason)}`);
        console.log(`      Attempts: ${job.attemptsMade}/${job.opts?.attempts || 'N/A'}`);
        console.log(`      Error: ${job.failedReason || 'N/A'}`);
        
        const failedTime = new Date(job.failedOn);
        const now = new Date();
        const timeSinceFailed = now - failedTime;
        console.log(`      Time since failure: ${formatDuration(timeSinceFailed)}`);
        console.log('');
      });
      
      // Count failures in last hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentFailures = failed.filter(job => new Date(job.failedOn) > oneHourAgo);
      console.log(`   ⚠️  Failures in last hour: ${recentFailures.length}`);
    } else {
      console.log('   ✅ No failed jobs');
    }
    console.log('');

    // 6. Waiting jobs
    console.log('6️⃣  WAITING JOBS');
    console.log('-'.repeat(60));
    
    if (waiting.length > 0) {
      console.log(`   ⏳ ${waiting.length} job(s) waiting to be processed:`);
      waiting.slice(0, 5).forEach((job, index) => {
        console.log(`      Job ${index + 1}: ID=${job.id}, Created=${formatTimestamp(job.timestamp)}`);
      });
      if (waiting.length > 5) {
        console.log(`      ... and ${waiting.length - 5} more`);
      }
    } else {
      console.log('   ℹ️  No waiting jobs');
    }
    console.log('');

    // 7. Worker running status
    console.log('7️⃣  WORKER RUNNING STATUS');
    console.log('-'.repeat(60));
    
    // Check if we can get queue info
    try {
      const queueInfo = await fetchQueue.getQueueMetrics();
      console.log(`   ✅ Queue is accessible`);
      console.log(`   Queue Name: ${fetchQueue.name}`);
      
      // Check if worker is running by checking if there's a worker connected
      // Note: BullMQ doesn't expose worker list directly, so we infer from activity
      if (scheduledJob && (active.length > 0 || completed.length > 0 || waiting.length > 0)) {
        console.log(`   ✅ Worker appears to be running (jobs are being processed)`);
      } else if (scheduledJob) {
        console.log(`   ⚠️  Worker may not be running (no recent activity)`);
        console.log(`   Check if worker process is actually running: ps aux | grep "workers/ingestion/index.mjs"`);
      } else {
        console.log(`   ❌ Worker not running (no scheduled job found)`);
      }
    } catch (err) {
      console.log(`   ❌ Cannot access queue: ${err.message}`);
      console.log(`   Check Redis connection: ${config.redis.url || 'REDIS_URL not set'}`);
    }
    console.log('');

    // 8. Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const isHealthy = scheduledJob && completed.length > 0 && failed.length === 0;
    const hasRecentActivity = completed.length > 0 && 
      (new Date() - new Date(completed[0].finishedOn)) < 10 * 60 * 1000; // Last 10 minutes
    
    if (isHealthy && hasRecentActivity) {
      console.log('✅ Worker Status: HEALTHY');
      console.log('   - Scheduled job is configured');
      console.log('   - Recent jobs completed successfully');
      console.log('   - No failures detected');
    } else if (scheduledJob && completed.length > 0) {
      console.log('⚠️  Worker Status: WARNING');
      if (!hasRecentActivity) {
        console.log('   - No recent job activity');
      }
      if (failed.length > 0) {
        console.log('   - Some jobs have failed');
      }
    } else if (scheduledJob) {
      console.log('⚠️  Worker Status: UNKNOWN');
      console.log('   - Scheduled job exists but no completed jobs found');
      console.log('   - Worker may not be running or jobs are being skipped');
    } else {
      console.log('❌ Worker Status: NOT RUNNING');
      console.log('   - No scheduled job found');
      console.log('   - Worker needs to be started');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');

    // Return status object for programmatic use
    return {
      isHealthy,
      hasRecentActivity,
      scheduledJob: scheduledJob ? {
        name: scheduledJob.name,
        cron: scheduledJob.cron || scheduledJob.pattern,
        nextRun: scheduledJob.next
      } : null,
      stats: {
        waiting: waiting.length,
        active: active.length,
        delayed: delayed.length,
        completed: completed.length,
        failed: failed.length
      },
      lastCompleted: completed.length > 0 ? {
        id: completed[0].id,
        finishedAt: completed[0].finishedOn
      } : null,
      recentFailures: failed.slice(0, 5).map(job => ({
        id: job.id,
        failedAt: job.failedOn,
        reason: job.failedReason
      }))
    };

  } catch (err) {
    console.error('\n❌ Error checking worker status:', err.message);
    console.error(err.stack);
    throw err;
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  getWorkerStatus()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to get worker status:', err);
      process.exit(1);
    });
}

export default getWorkerStatus;

