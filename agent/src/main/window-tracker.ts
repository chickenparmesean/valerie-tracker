import { v4 as uuidv4 } from 'uuid';
import { queueForSync } from './database';
import { getTimerState } from './timer';
import { config } from './config';

interface WindowState {
  appName: string;
  windowTitle: string;
  processPath: string;
  startedAt: number;
  durationSec: number;
}

let windowInterval: ReturnType<typeof setInterval> | null = null;
let flushInterval: ReturnType<typeof setInterval> | null = null;
let currentWindow: WindowState | null = null;
let pendingSamples: WindowState[] = [];
let activeWindowModule: typeof import('@miniben90/x-win') | null = null;
let pollCount = 0;
let firstSuccess = true;
let skipLogged = false;

export function startWindowTracking(): void {
  console.log('[Window] Starting window tracker, interval:', config.windowPollMs, 'ms');

  // Dynamically import x-win (native module)
  try {
    activeWindowModule = require('@miniben90/x-win');
    console.log('[Window] @miniben90/x-win loaded successfully');
  } catch (err: any) {
    console.error('[Window] Failed to load @miniben90/x-win — window tracking disabled:', err.message);
    return;
  }

  windowInterval = setInterval(() => {
    const timerState = getTimerState();
    if (!timerState.isRunning) {
      if (!skipLogged) {
        console.log('[Window] Skipping — timer not running');
        skipLogged = true;
      }
      return;
    }
    // Reset skip log flag once timer is running
    skipLogged = false;

    if (!activeWindowModule) return;

    pollCount++;

    try {
      const win = activeWindowModule.activeWindow();
      const appName = win.info.name || 'Unknown';
      const windowTitle = win.title || '';
      const processPath = win.info.execName || '';

      if (firstSuccess) {
        console.log('[Window] First active window:', JSON.stringify({ appName, windowTitle, processPath }));
        firstSuccess = false;
      }

      // Log every 20th poll (once per minute at 3s interval)
      if (pollCount % 20 === 0) {
        console.log('[Window] Poll #' + pollCount + ' — current:', appName);
      }

      if (!currentWindow) {
        currentWindow = {
          appName,
          windowTitle,
          processPath,
          startedAt: Date.now(),
          durationSec: 0,
        };
        return;
      }

      // Heartbeat pattern: extend if same app
      if (currentWindow.appName === appName) {
        currentWindow.durationSec = Math.floor(
          (Date.now() - currentWindow.startedAt) / 1000
        );
        currentWindow.windowTitle = windowTitle;
      } else {
        // Different app — finalize previous
        const prevApp = currentWindow.appName;
        currentWindow.durationSec = Math.floor(
          (Date.now() - currentWindow.startedAt) / 1000
        );
        console.log('[Window] App switch:', prevApp, '->', appName, '— title:', windowTitle, 'prevDuration:', currentWindow.durationSec, 's');
        if (currentWindow.durationSec > 0) {
          pendingSamples.push({ ...currentWindow });
        }

        currentWindow = {
          appName,
          windowTitle,
          processPath,
          startedAt: Date.now(),
          durationSec: 0,
        };
      }
    } catch (err: any) {
      console.error('[Window] x-win error:', err.message);
    }
  }, config.windowPollMs);

  // Flush every 60 seconds
  flushInterval = setInterval(() => {
    flushWindowSamples();
  }, 60_000);
}

function flushWindowSamples(): void {
  const timerState = getTimerState();
  if (!timerState.idempotencyKey) return;

  // Finalize current window too
  if (currentWindow && currentWindow.durationSec === 0) {
    currentWindow.durationSec = Math.floor(
      (Date.now() - currentWindow.startedAt) / 1000
    );
  }

  const toFlush = [...pendingSamples];
  pendingSamples = [];

  for (const sample of toFlush) {
    if (sample.durationSec <= 0) continue;
    const key = uuidv4();
    console.log('[Window] Sample saved:', sample.appName, sample.durationSec, 's');
    queueForSync(
      'window_sample',
      {
        idempotencyKey: key,
        timestamp: new Date(sample.startedAt).toISOString(),
        appName: sample.appName,
        windowTitle: sample.windowTitle,
        processPath: sample.processPath,
        durationSec: sample.durationSec,
        timeEntryId: timerState.idempotencyKey,
      },
      key
    );
  }
}

export function stopWindowTracking(): void {
  flushWindowSamples();
  if (windowInterval) {
    clearInterval(windowInterval);
    windowInterval = null;
  }
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  currentWindow = null;
  pendingSamples = [];
}

export function getCurrentApp(): string {
  return currentWindow?.appName ?? '';
}
