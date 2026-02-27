import { ipcMain } from 'electron';
import { signIn, signOut, isAuthenticated, getAuthHeaders } from './auth';
import { startTimer, stopTimer, getTimerState } from './timer';
import { handleIdleResponse } from './idle-detector';
import { config, isDevMode } from './config';
import { initTrackerConfig, getTrackerError, isTrackerReady } from './tracker-config';

export function registerIpcHandlers(): void {
  // Auth
  ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
    return await signIn(email, password);
  });

  ipcMain.handle('auth:logout', async () => {
    stopTimer();
    await signOut();
    return { success: true };
  });

  ipcMain.handle('auth:session', () => {
    return {
      authenticated: isAuthenticated(),
      mode: isDevMode ? 'dev' : 'normal',
      error: getTrackerError(),
    };
  });

  // Timer
  ipcMain.handle('timer:start', (_event, projectId: string, taskId?: string) => {
    startTimer(projectId, taskId);
    return { success: true };
  });

  ipcMain.handle('timer:stop', () => {
    stopTimer();
    return { success: true };
  });

  ipcMain.handle('timer:status', () => {
    return getTimerState();
  });

  // Projects — fetch from API
  ipcMain.handle('projects:list', async () => {
    const headers = getAuthHeaders();
    if (!headers) return [];

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/projects`, {
        headers,
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  });

  // Idle
  ipcMain.on('idle:respond', (_event, choice: 'keep' | 'discard-resume' | 'discard-stop') => {
    handleIdleResponse(choice);
  });

  // Config retry (for ErrorScreen)
  ipcMain.handle('config:retry', async () => {
    const result = await initTrackerConfig();
    if (result.status === 'ready') {
      // Lazy require to avoid circular dependency (index.ts imports ipc.ts)
      const { startEngines } = require('./index');
      startEngines();
    }
    return {
      status: result.status,
      error: result.status !== 'ready' ? result.status : null,
    };
  });

  // Config state (for renderer to check on load)
  ipcMain.handle('config:state', () => {
    return {
      ready: isTrackerReady(),
      error: getTrackerError(),
      mode: isDevMode ? 'dev' : 'normal',
    };
  });

  // App
  ipcMain.handle('app:version', () => {
    const { app } = require('electron');
    return app.getVersion();
  });
}
