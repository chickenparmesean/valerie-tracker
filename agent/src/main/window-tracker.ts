import { v4 as uuidv4 } from 'uuid';
import { queueForSync } from './database';
import { getTimerState } from './timer';
import { config } from './config';
import { getLastUrl } from './url-bridge';
import { getTrackerSettings } from './tracker-config';

interface WindowState {
  appName: string;
  windowTitle: string;
  processPath: string;
  pageTitle: string | null;
  url: string | null;
  startedAt: number;
  durationSec: number;
}

function extractChromePageTitle(appName: string, windowTitle: string): string | null {
  if (!appName.includes('Chrome')) return null;
  const suffix = ' - Google Chrome';
  if (!windowTitle.endsWith(suffix)) return null;
  const title = windowTitle.slice(0, -suffix.length);
  return title || null;
}

let windowInterval: ReturnType<typeof setInterval> | null = null;
let flushInterval: ReturnType<typeof setInterval> | null = null;
let currentWindow: WindowState | null = null;
let pendingSamples: WindowState[] = [];
let activeWindowModule: typeof import('@miniben90/x-win') | null = null;
let pollCount = 0;
let firstSuccess = true;
let skipLogged = false;
let lastLoggedTitle: string | null = null;

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

      const pageTitle = extractChromePageTitle(appName, windowTitle);
      if (pageTitle && pageTitle !== lastLoggedTitle) {
        console.log('[Window] Chrome page title:', pageTitle);
        lastLoggedTitle = pageTitle;
      }

      // URL tracking: attach Chrome URL if trackUrls enabled and app is Chrome
      const settings = getTrackerSettings();
      const isChrome = appName.toLowerCase().includes('chrome');
      const url = (isChrome && settings?.trackUrls) ? getLastUrl() : null;

      if (isChrome) {
        if (url) {
          console.log(`[Window] URL lookup: ${url}`);
          console.log(`[Window] URL attached to sample: ${url}`);
        } else {
          console.log('[Window] URL lookup: null');
          console.log('[Window] No URL for Chrome sample');
        }
      }

      if (!currentWindow) {
        currentWindow = {
          appName,
          windowTitle,
          processPath,
          pageTitle,
          url,
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
        currentWindow.pageTitle = pageTitle;
        currentWindow.url = url;
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
          pageTitle,
          url,
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
        pageTitle: sample.pageTitle,
        url: sample.url,
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
  console.log('[Window] Stopped');
}

export function getCurrentApp(): string {
  return currentWindow?.appName ?? '';
}
