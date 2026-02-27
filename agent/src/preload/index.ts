import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (email: string, password: string) =>
      ipcRenderer.invoke('auth:login', email, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:session'),
  },
  timer: {
    start: (projectId: string, taskId?: string) =>
      ipcRenderer.invoke('timer:start', projectId, taskId),
    stop: () => ipcRenderer.invoke('timer:stop'),
    getStatus: () => ipcRenderer.invoke('timer:status'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
  },
  config: {
    retry: () => ipcRenderer.invoke('config:retry'),
    getState: () => ipcRenderer.invoke('config:state'),
  },
  app: {
    minimize: () => ipcRenderer.invoke('app:minimize'),
    quit: () => ipcRenderer.invoke('app:quit'),
    getVersion: () => ipcRenderer.invoke('app:version'),
  },
  idle: {
    respond: (choice: 'keep' | 'discard-resume' | 'discard-stop') =>
      ipcRenderer.send('idle:respond', choice),
  },
  onTimerUpdate: (callback: (data: unknown) => void) => {
    ipcRenderer.on('timer:update', (_event, data) => callback(data));
  },
  onTimerStopped: (callback: () => void) => {
    ipcRenderer.on('timer:stopped', () => callback());
  },
  onIdlePrompt: (callback: (data: { idleMinutes: number }) => void) => {
    ipcRenderer.on('idle:prompt', (_event, data) => callback(data));
  },
  onScreenshotCaptured: (callback: () => void) => {
    ipcRenderer.on('screenshot:captured', () => callback());
  },
  onConfigReady: (callback: () => void) => {
    ipcRenderer.on('config:ready', () => callback());
  },
  onConfigError: (callback: (error: string) => void) => {
    ipcRenderer.on('config:error', (_event, error) => callback(error));
  },
});
