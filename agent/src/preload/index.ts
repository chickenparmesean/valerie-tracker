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
    setNote: (note: string) =>
      ipcRenderer.invoke('timer:setNote', note) as Promise<{ success: boolean }>,
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
  },
  config: {
    retry: () => ipcRenderer.invoke('config:retry'),
    getState: () => ipcRenderer.invoke('config:state'),
  },
  time: {
    getTodayTotal: () => ipcRenderer.invoke('time:getTodayTotal') as Promise<number>,
  },
  tasks: {
    create: (projectId: string, title: string) =>
      ipcRenderer.invoke('tasks:create', projectId, title) as Promise<{ success: boolean; error?: string; task?: unknown }>,
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
