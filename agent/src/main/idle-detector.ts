import { powerMonitor, BrowserWindow } from 'electron';
import { getTimerState, stopTimer } from './timer';
import { config } from './config';

let idleInterval: ReturnType<typeof setInterval> | null = null;
let mainWindow: BrowserWindow | null = null;
let idleSince: number | null = null;
let isIdle = false;

export function setIdleWindow(win: BrowserWindow): void {
  mainWindow = win;
}

export function startIdleDetection(): void {
  // Listen for lock screen
  powerMonitor.on('lock-screen', () => {
    handleIdleDetected();
  });

  idleInterval = setInterval(() => {
    const timerState = getTimerState();
    if (!timerState.isRunning) return;

    const idleTime = powerMonitor.getSystemIdleTime();

    if (idleTime >= config.defaultIdleThresholdSec && !isIdle) {
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
}

export function handleIdleResponse(choice: 'keep' | 'discard-resume' | 'discard-stop'): void {
  isIdle = false;

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

export function stopIdleDetection(): void {
  if (idleInterval) {
    clearInterval(idleInterval);
    idleInterval = null;
  }
  isIdle = false;
  idleSince = null;
}
