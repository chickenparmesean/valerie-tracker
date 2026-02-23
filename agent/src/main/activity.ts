import { powerMonitor } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { queueForSync } from './database';
import { getTimerState, incrementActivity } from './timer';
import { config } from './config';

let activityInterval: ReturnType<typeof setInterval> | null = null;
let windowSeconds = 0;
let activeSeconds = 0;

export function startActivityDetection(): void {
  windowSeconds = 0;
  activeSeconds = 0;

  activityInterval = setInterval(() => {
    const timerState = getTimerState();
    if (!timerState.isRunning) return;

    const idleTime = powerMonitor.getSystemIdleTime();
    const isActive = idleTime < 1;

    incrementActivity(isActive);

    if (isActive) {
      activeSeconds++;
    }
    windowSeconds++;

    // Every 60 seconds, create activity snapshot
    if (windowSeconds >= 60) {
      const activityPct = Math.round((activeSeconds / windowSeconds) * 100);

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
