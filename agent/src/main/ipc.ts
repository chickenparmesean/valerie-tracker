import { ipcMain } from 'electron';
import { signIn, signOut, isAuthenticated, getAuthHeaders } from './auth';
import { startTimer, stopTimer, getTimerState } from './timer';
import { handleIdleResponse } from './idle-detector';
import { config, isDevMode } from './config';
import { initTrackerConfig, getTrackerError, isTrackerReady } from './tracker-config';
import { getTodayStoppedSecondsFromOutbox } from './database';

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
      const url = `${config.apiBaseUrl}/api/tracker/projects`;
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.projects || [];
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

  // Today time total — returns stopped entries total (renderer adds running elapsed for real-time display)
  ipcMain.handle('time:getTodayTotal', async () => {
    const timerState = getTimerState();
    const localRunning = timerState.isRunning ? timerState.elapsedSec : 0;

    const headers = getAuthHeaders();
    if (!headers) {
      // Offline / not authenticated — fall back to local SQLite
      const localStopped = getTodayStoppedSecondsFromOutbox();
      console.log('[IPC] time:getTodayTotal — offline fallback, local stopped:', localStopped, 's, local running:', localRunning, 's');
      return localStopped;
    }

    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const res = await fetch(`${config.apiBaseUrl}/api/time-entries?date=${dateStr}`, {
        headers,
      });

      if (!res.ok) {
        // API error — fall back to local SQLite
        const localStopped = getTodayStoppedSecondsFromOutbox();
        console.log('[IPC] time:getTodayTotal — API', res.status, ', fallback local stopped:', localStopped, 's, local running:', localRunning, 's');
        return localStopped;
      }

      const entries: Array<{ durationSec?: number; stoppedAt?: string | null }> = await res.json();

      let serverStopped = 0;
      for (const entry of entries) {
        if (entry.stoppedAt && entry.durationSec) {
          serverStopped += entry.durationSec;
        }
      }

      console.log('[IPC] time:getTodayTotal — server:', serverStopped, 's, local running:', localRunning, 's, total:', serverStopped + localRunning, 's');
      return serverStopped;
    } catch (err: any) {
      // Network error — fall back to local SQLite
      const localStopped = getTodayStoppedSecondsFromOutbox();
      console.log('[IPC] time:getTodayTotal — network error:', err.message, ', fallback local stopped:', localStopped, 's, local running:', localRunning, 's');
      return localStopped;
    }
  });

  // Create task
  ipcMain.handle('tasks:create', async (_event, projectId: string, title: string) => {
    const headers = getAuthHeaders();
    if (!headers) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/tracker/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: text };
      }
      const data = await res.json();
      return { success: true, task: data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });
}
