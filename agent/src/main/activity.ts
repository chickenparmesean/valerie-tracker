import { powerMonitor } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { queueForSync } from './database';
import { getTimerState, incrementActivity } from './timer';
import { config } from './config';

let activityInterval: ReturnType<typeof setInterval> | null = null;
let windowSeconds = 0;
let activeSeconds = 0;
let pollCount = 0;
let firstPoll = true;

export function startActivityDetection(): void {
  windowSeconds = 0;
  activeSeconds = 0;
  pollCount = 0;
  firstPoll = true;

  console.log('[Activity] Starting activity monitor, interval:', config.activityPollMs, 'ms');

  activityInterval = setInterval(() => {
    const timerState = getTimerState();
    if (!timerState.isRunning) return;

    let idleTime: number;
    try {
      idleTime = powerMonitor.getSystemIdleTime();
    } catch (err: any) {
      console.error('[Activity] powerMonitor.getSystemIdleTime() error:', err.message);
      return;
    }

    if (firstPoll) {
      console.log('[Activity] First idle time reading:', idleTime, 's');
      firstPoll = false;
    }

    const isActive = idleTime < 1;

    incrementActivity(isActive);

    if (isActive) {
      activeSeconds++;
    }
    windowSeconds++;
    pollCount++;

    // Log every 10th poll to avoid spam
    if (pollCount % 10 === 0) {
      console.log('[Activity] Poll #' + pollCount + ' — idleTime:', idleTime, 's, activeThisWindow:', activeSeconds, '/' + windowSeconds);
    }

    // Every 60 seconds, create activity snapshot
    if (windowSeconds >= 60) {
      const activityPct = Math.round((activeSeconds / windowSeconds) * 100);

      console.log('[Activity] Snapshot created — activityPct:', activityPct, '%, activeSeconds:', activeSeconds, '/60');

      if (timerState.idempotencyKey) {
        queueForSync(
          'activity_snapshot',
          {
            idempotencyKey: uuidv4(),
            timestamp: new Date().toISOString(),
            intervalSec: windowSeconds,
            activityPct,
            timeEntryId: timerState.idempotencyKey,
          },
          uuidv4()
        );
      }

      // Reset window
      windowSeconds = 0;
      activeSeconds = 0;
    }
  }, config.activityPollMs);
}

export function stopActivityDetection(): void {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
}

export function getCurrentActivityPct(): number {
  if (windowSeconds === 0) return 0;
  return Math.round((activeSeconds / windowSeconds) * 100);
}
