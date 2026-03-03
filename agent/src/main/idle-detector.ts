import { powerMonitor, BrowserWindow } from 'electron';
import { getTimerState, stopTimer } from './timer';
import { config } from './config';
import { getTrackerSettings } from './tracker-config';

let idleInterval: ReturnType<typeof setInterval> | null = null;
let mainWindow: BrowserWindow | null = null;
let idleSince: number | null = null;
let isIdle = false;
let autoStopTimeout: ReturnType<typeof setTimeout> | null = null;

export function setIdleWindow(win: BrowserWindow): void {
  mainWindow = win;
}

export function startIdleDetection(): void {
  const thresholdMin = config.defaultIdleThresholdSec / 60;
  const pollIntervalSec = config.idlePollMs / 1000;
  console.log('[Idle] Starting idle detector, threshold:', thresholdMin, 'min, poll interval:', pollIntervalSec, 's');

  // Listen for lock screen
  powerMonitor.on('lock-screen', () => {
    console.log('[Idle] Lock screen detected');
    handleIdleDetected();
  });

  idleInterval = setInterval(() => {
    const timerState = getTimerState();
    if (!timerState.isRunning) return;

    const idleTimeSec = powerMonitor.getSystemIdleTime();
    const thresholdSec = config.defaultIdleThresholdSec;

    console.log('[Idle] Check — idle time:', idleTimeSec, 's, threshold:', thresholdSec, 's');

    if (idleTimeSec >= thresholdSec && !isIdle) {
      console.log('[Idle] ⚠ IDLE THRESHOLD REACHED — idle for', idleTimeSec, 's');
      handleIdleDetected();
    }
  }, config.idlePollMs);
}

function handleIdleDetected(): void {
  const timerState = getTimerState();
  if (!timerState.isRunning || isIdle) return;

  isIdle = true;
  idleSince = Date.now();

  const idleMinutes = Math.floor(
    powerMonitor.getSystemIdleTime() / 60
  );

  mainWindow?.webContents.send('idle:prompt', {
    idleMinutes: Math.max(idleMinutes, Math.floor(config.defaultIdleThresholdSec / 60)),
  });

  // Start auto-stop timeout — if the idle prompt goes unanswered, auto-stop the timer
  const settings = getTrackerSettings();
  const autoStopMin = settings?.autoStopIdleMin ?? 15;
  const autoStopMs = autoStopMin * 60 * 1000;

  clearAutoStopTimeout();
  autoStopTimeout = setTimeout(() => {
    if (!isIdle) return;
    console.log(`[Idle] Idle prompt unanswered for ${autoStopMin} minutes — auto-stopping timer and discarding idle time`);
    isIdle = false;
    idleSince = null;
    autoStopTimeout = null;
    stopTimer();
    mainWindow?.webContents.send('idle:dismissed');
  }, autoStopMs);
}

export function handleIdleResponse(choice: 'keep' | 'discard-resume' | 'discard-stop'): void {
  isIdle = false;
  clearAutoStopTimeout();

  switch (choice) {
    case 'keep':
      // Keep time, resume — do nothing, timer continues
      break;
    case 'discard-resume':
      // Discard idle time but keep timer running
      // For simplicity, we just continue — the idle seconds are already tracked
      break;
    case 'discard-stop':
      stopTimer();
      break;
  }

  idleSince = null;
}

function clearAutoStopTimeout(): void {
  if (autoStopTimeout) {
    clearTimeout(autoStopTimeout);
    autoStopTimeout = null;
  }
}

export function stopIdleDetection(): void {
  if (idleInterval) {
    clearInterval(idleInterval);
    idleInterval = null;
  }
  clearAutoStopTimeout();
  isIdle = false;
  idleSince = null;
  console.log('[Idle] Stopped');
}
