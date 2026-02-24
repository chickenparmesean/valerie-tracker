import path from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env before any module reads process.env
const envPaths = [
  path.resolve(__dirname, '..', '..', '.env'),       // from agent/dist-main/
  path.resolve(__dirname, '..', '..', '..', '.env'),  // fallback
  path.resolve(process.cwd(), '.env'),                // from wherever npm run dev is called
];
for (const envPath of envPaths) {
  const result = dotenvConfig({ path: envPath });
  if (!result.error) break;
}

import { app, BrowserWindow } from 'electron';
import { initDatabase } from './database';
import { initAuth, restoreSession, startAutoRefresh } from './auth';
import { registerIpcHandlers } from './ipc';
import { createTray, destroyTray } from './tray';
import { setMainWindow, resumeTimer } from './timer';
import { setScreenshotWindow, startScreenshotSchedule, stopScreenshotSchedule } from './screenshot';
import { startActivityDetection, stopActivityDetection } from './activity';
import { startWindowTracking, stopWindowTracking } from './window-tracker';
import { setIdleWindow, startIdleDetection, stopIdleDetection } from './idle-detector';
import { startSyncEngine, stopSyncEngine } from './sync';
import { enableAutoLaunch } from './auto-launch';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 640,
    minWidth: 340,
    minHeight: 500,
    resizable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  // Hide to tray on close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Set window references
  setMainWindow(mainWindow);
  setScreenshotWindow(mainWindow);
  setIdleWindow(mainWindow);

  // Create system tray
  createTray(mainWindow);
}

app.whenReady().then(async () => {
  // Initialize
  initDatabase();
  initAuth();
  registerIpcHandlers();

  createWindow();

  // Try to restore session
  const restored = await restoreSession();
  if (restored) {
    startAutoRefresh();
    startEngines();
    resumeTimer();
  }

  // Auto-launch on Windows
  enableAutoLaunch();
});

function startEngines(): void {
  startActivityDetection();
  startWindowTracking();
  startScreenshotSchedule();
  startIdleDetection();
  startSyncEngine();
}

app.on('before-quit', () => {
  isQuitting = true;
  stopActivityDetection();
  stopWindowTracking();
  stopScreenshotSchedule();
  stopIdleDetection();
  stopSyncEngine();
  destroyTray();
});

app.on('window-all-closed', () => {
  // Don't quit — tray keeps running
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// Export for IPC to trigger engine start after login
export { startEngines };
