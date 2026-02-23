import { ipcMain } from 'electron';
import { signIn, signOut, isAuthenticated, getAccessToken } from './auth';
import { startTimer, stopTimer, getTimerState } from './timer';
import { handleIdleResponse } from './idle-detector';
import { config } from './config';

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
    return { authenticated: isAuthenticated() };
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
    const token = getAccessToken();
    if (!token) return [];

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
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

  // App
  ipcMain.handle('app:version', () => {
    const { app } = require('electron');
    return app.getVersion();
  });
}
