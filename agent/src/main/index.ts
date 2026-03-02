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

// Enable Chromium internal logging
app.commandLine.appendSwitch('enable-logging');

// Disable GPU acceleration to prevent renderer crash on AWS WorkSpaces
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'Cache'));
app.commandLine.appendSwitch('lang', 'en-US');

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function probeNativeModules(): void {
  console.log('[Native] Probing native modules...');
  const modules = [
    { name: '@miniben90/x-win', test: () => { const xwin = require('@miniben90/x-win'); return typeof xwin.activeWindow === 'function'; } },
    { name: 'screenshot-desktop', test: () => { const sd = require('screenshot-desktop'); return typeof sd === 'function' || typeof sd.listDisplays === 'function'; } },
    { name: 'better-sqlite3', test: () => { const Db = require('better-sqlite3'); return typeof Db === 'function'; } },
    { name: 'sharp', test: () => { const sharp = require('sharp'); return typeof sharp === 'function'; } },
  ];
  for (const mod of modules) {
    try {
      const ok = mod.test();
      console.log(`[Native] ✓ ${mod.name} loaded (test=${ok})`);
    } catch (err: any) {
      console.error(`[Native] ✗ ${mod.name} FAILED: ${err.message}`);
    }
  }
}

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
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '..', 'resources', 'icon.ico'),
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const filePath = path.join(__dirname, '..', 'dist-renderer', 'index.html');
    mainWindow.loadFile(filePath);
  }

  // DevTools: try undocked mode with explicit dimensions
  mainWindow.webContents.on('did-finish-load', () => {
    try {
      mainWindow?.webContents.openDevTools({ mode: 'undocked' });
      console.log('[DevTools] Opened in undocked mode');
    } catch (err: any) {
      console.error('[DevTools] Failed to open:', err.message);
    }
  });

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
  // Probe native modules first — before anything else
  probeNativeModules();

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
      console.log('[Init] trackerConfig result:', JSON.stringify(result));
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
  try {
    console.log('[Engine] Starting activity detector...');
    startActivityDetection();
    console.log('[Engine] ✓ Activity detector started');
  } catch (err: any) {
    console.error(`[Engine] ✗ Activity detector FAILED: ${err.message}`, err.stack);
  }

  try {
    console.log('[Engine] Starting window tracker...');
    startWindowTracking();
    console.log('[Engine] ✓ Window tracker started');
  } catch (err: any) {
    console.error(`[Engine] ✗ Window tracker FAILED: ${err.message}`, err.stack);
  }

  try {
    console.log('[Engine] Starting screenshot schedule...');
    startScreenshotSchedule();
    console.log('[Engine] ✓ Screenshot schedule started');
  } catch (err: any) {
    console.error(`[Engine] ✗ Screenshot schedule FAILED: ${err.message}`, err.stack);
  }

  try {
    console.log('[Engine] Starting idle detector...');
    startIdleDetection();
    console.log('[Engine] ✓ Idle detector started');
  } catch (err: any) {
    console.error(`[Engine] ✗ Idle detector FAILED: ${err.message}`, err.stack);
  }

  try {
    console.log('[Engine] Starting sync engine...');
    startSyncEngine();
    console.log('[Engine] ✓ Sync engine started');
  } catch (err: any) {
    console.error(`[Engine] ✗ Sync engine FAILED: ${err.message}`, err.stack);
  }
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
