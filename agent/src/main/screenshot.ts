import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { queueScreenshot } from './database';
import { getTimerState } from './timer';
import { getCurrentActivityPct } from './activity';
import { getCurrentApp } from './window-tracker';
import { config } from './config';

let screenshotTimeout: ReturnType<typeof setTimeout> | null = null;
let mainWindow: Electron.BrowserWindow | null = null;

export function setScreenshotWindow(win: Electron.BrowserWindow): void {
  mainWindow = win;
}

export function startScreenshotSchedule(): void {
  console.log('[Screenshot] Starting screenshot schedule');
  scheduleNextScreenshot();
}

export function stopScreenshotSchedule(): void {
  if (screenshotTimeout) {
    clearTimeout(screenshotTimeout);
    screenshotTimeout = null;
  }
  console.log('[Screenshot] Stopped');
}

function scheduleNextScreenshot(): void {
  // Random offset between 30s and 570s (9.5 min) within 10-min window
  const minOffset = 30_000;
  const maxOffset = 570_000;
  const offsetMs = minOffset + Math.random() * (maxOffset - minOffset);

  console.log('[Screenshot] New window — next capture in', Math.round(offsetMs / 1000), 'seconds (at', new Date(Date.now() + offsetMs).toLocaleTimeString(), ')');

  screenshotTimeout = setTimeout(async () => {
    const timerState = getTimerState();
    if (timerState.isRunning) {
      await captureScreenshot();
    } else {
      console.log('[Screenshot] Timer not running — skipping capture');
    }
    scheduleNextScreenshot();
  }, offsetMs);
}

async function captureScreenshot(): Promise<void> {
  try {
    console.log('[Screenshot] Capturing now...');

    // Dynamically require screenshot-desktop (native module)
    const screenshot = require('screenshot-desktop');
    const sharp = require('sharp');

    const imgBuffer: Buffer = await screenshot({ format: 'png' });
    console.log('[Screenshot] Captured — buffer size:', imgBuffer.length, 'bytes');

    // Compress to WebP
    const webpBuffer: Buffer = await sharp(imgBuffer)
      .webp({ quality: 75 })
      .toBuffer();

    console.log('[Screenshot] Compressed to WebP —', webpBuffer.length, 'bytes');

    const idempotencyKey = uuidv4();

    // Ensure screenshots directory exists
    if (!fs.existsSync(config.screenshotsDir)) {
      fs.mkdirSync(config.screenshotsDir, { recursive: true });
    }

    const filePath = path.join(config.screenshotsDir, `${idempotencyKey}.webp`);
    fs.writeFileSync(filePath, webpBuffer);

    const timerState = getTimerState();
    const activityPct = getCurrentActivityPct();
    const activeApp = getCurrentApp();

    // Queue for upload
    queueScreenshot(idempotencyKey, filePath, {
      idempotencyKey,
      capturedAt: new Date().toISOString(),
      activityPct,
      activeApp,
      activeTitle: '',
      fileSizeBytes: webpBuffer.length,
      timeEntryId: timerState.idempotencyKey,
    });

    mainWindow?.webContents.send('screenshot:captured');
  } catch (err: any) {
    console.error('[Screenshot] CAPTURE ERROR:', err.message, err.stack);
  }
}
