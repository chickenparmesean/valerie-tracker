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

import { app, BrowserWindow, Menu } from 'electron';
import { isDevMode } from './config';
import { initDatabase } from './database';
import { initAuth, restoreSession, startAutoRefresh } from './auth';
import { initTrackerConfig } from './tracker-config';
import { registerIpcHandlers } from './ipc';
import { createTray, destroyTray } from './tray';
import { setMainWindow, resumeTimer } from './timer';
import { setScreenshotWindow, startScreenshotSchedule, stopScreenshotSchedule } from './screenshot';
import { startActivityDetection, stopActivityDetection } from './activity';
import { startWindowTracking, stopWindowTracking } from './window-tracker';
import { setIdleWindow, startIdleDetection, stopIdleDetection } from './idle-detector';
import { startSyncEngine, stopSyncEngine } from './sync';
import { enableAutoLaunch } from './auto-launch';
import { initAutoUpdater, stopAutoUpdater } from './auto-updater';

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

  // DEBUG: force DevTools open to catch white-screen errors
  mainWindow.webContents.openDevTools({ mode: 'detach' });

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

  // Set application menu without Help
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

app.whenReady().then(async () => {
  // Initialize database (always needed)
  initDatabase();

  if (isDevMode) {
    // --- DEV MODE: existing Supabase Auth flow ---
    console.log('Tracker: starting in --dev mode (Supabase Auth)');
    initAuth();
    registerIpcHandlers();
    createWindow();

    const restored = await restoreSession();
    if (restored) {
      startAutoRefresh();
      startEngines();
      resumeTimer();
    }
  } else {
    // --- NORMAL MODE: API key from config.json / safeStorage ---
    console.log('Tracker: starting in normal mode (API key auth)');
    initAuth(); // no-op in normal mode, but keeps the module initialized
    registerIpcHandlers();
    createWindow();

    const result = await initTrackerConfig();

    if (result.status === 'ready') {
      console.log('Tracker: config loaded, starting engines');
      // Notify renderer that auth succeeded
      mainWindow?.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send('config:ready');
      });
      // If page already loaded, send immediately
      if (!mainWindow?.webContents.isLoading()) {
        mainWindow?.webContents.send('config:ready');
      }
      startEngines();
      resumeTimer();
    } else {
      console.log(`Tracker: config failed — ${result.status}`);
      // Renderer will check error state via IPC and show ErrorScreen
      mainWindow?.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send('config:error', result.status);
      });
      if (!mainWindow?.webContents.isLoading()) {
        mainWindow?.webContents.send('config:error', result.status);
      }
    }
  }

  // Auto-launch on Windows
  enableAutoLaunch();

  // Auto-update from GitHub Releases (skip in dev mode)
  if (!isDevMode) {
    initAutoUpdater();
  }
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
  stopAutoUpdater();
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
