import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import {
  queueForSync,
  saveActiveTimeEntry,
  getActiveTimeEntry,
  clearActiveTimeEntry,
} from './database';

export interface TimerState {
  isRunning: boolean;
  projectId: string | null;
  taskId: string | null;
  startedAt: Date | null;
  elapsedSec: number;
  idempotencyKey: string | null;
  activeSec: number;
  idleSec: number;
}

let state: TimerState = {
  isRunning: false,
  projectId: null,
  taskId: null,
  startedAt: null,
  elapsedSec: 0,
  idempotencyKey: null,
  activeSec: 0,
  idleSec: 0,
};

let tickInterval: ReturnType<typeof setInterval> | null = null;
let mainWindow: BrowserWindow | null = null;
let tickCount = 0;

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

export function getTimerState(): TimerState {
  return { ...state };
}

export function startTimer(projectId: string, taskId?: string): void {
  console.log('[Timer] start() called — projectId:', projectId, 'taskId:', taskId ?? '(none)');

  if (state.isRunning) {
    console.log('[Timer] Already running — stopping first');
    stopTimer();
  }

  const idempotencyKey = uuidv4();
  const startedAt = new Date();

  state = {
    isRunning: true,
    projectId,
    taskId: taskId ?? null,
    startedAt,
    elapsedSec: 0,
    idempotencyKey,
    activeSec: 0,
    idleSec: 0,
  };

  console.log('[Timer] State transition: stopped -> running, key:', idempotencyKey);

  // Persist to SQLite
  saveActiveTimeEntry({
    idempotencyKey,
    projectId,
    taskId,
    startedAt: startedAt.toISOString(),
  });

  // Queue initial sync
  queueTimeEntrySync();

  tickCount = 0;

  // Start tick
  tickInterval = setInterval(() => {
    if (!state.isRunning || !state.startedAt) return;
    state.elapsedSec = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
    tickCount++;
    // Log every 60th tick (once per minute)
    if (tickCount % 60 === 0) {
      console.log('[Timer] Running — elapsed:', state.elapsedSec, 's, activeSec:', state.activeSec, 'idleSec:', state.idleSec);
    }
    emitTimerUpdate();
  }, 1000);
}

export function stopTimer(): void {
  if (!state.isRunning || !state.startedAt) return;

  const durationSec = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
  console.log('[Timer] stop() called — duration:', durationSec, 's, activeSec:', state.activeSec, 'idleSec:', state.idleSec);
  console.log('[Timer] State transition: running -> stopped');

  state.isRunning = false;

  // Queue final sync with STOPPED status
  queueForSync(
    'time_entry',
    {
      idempotencyKey: state.idempotencyKey,
      startedAt: state.startedAt.toISOString(),
      stoppedAt: new Date().toISOString(),
      durationSec,
      activeSec: state.activeSec,
      idleSec: state.idleSec,
      activityPct: durationSec > 0 ? Math.round((state.activeSec / durationSec) * 100) : 0,
      status: 'STOPPED',
      projectId: state.projectId,
      taskId: state.taskId,
    },
    state.idempotencyKey!
  );

  clearActiveTimeEntry();

  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  mainWindow?.webContents.send('timer:stopped');

  state = {
    isRunning: false,
    projectId: null,
    taskId: null,
    startedAt: null,
    elapsedSec: 0,
    idempotencyKey: null,
    activeSec: 0,
    idleSec: 0,
  };
}

export function resumeTimer(): void {
  const saved = getActiveTimeEntry();
  if (!saved || saved.status !== 'RUNNING') {
    console.log('[Timer] resumeTimer() — no active time entry to resume');
    return;
  }

  const startedAt = new Date(saved.started_at);
  console.log('[Timer] Resuming timer — projectId:', saved.project_id, 'taskId:', saved.task_id, 'startedAt:', saved.started_at);

  state = {
    isRunning: true,
    projectId: saved.project_id,
    taskId: saved.task_id,
    startedAt,
    elapsedSec: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    idempotencyKey: saved.idempotency_key,
    activeSec: 0,
    idleSec: 0,
  };

  console.log('[Timer] State transition: stopped -> running (resume), elapsed so far:', state.elapsedSec, 's');

  tickCount = 0;

  tickInterval = setInterval(() => {
    if (!state.isRunning || !state.startedAt) return;
    state.elapsedSec = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
    tickCount++;
    if (tickCount % 60 === 0) {
      console.log('[Timer] Running — elapsed:', state.elapsedSec, 's, activeSec:', state.activeSec, 'idleSec:', state.idleSec);
    }
    emitTimerUpdate();
  }, 1000);
}

export function incrementActivity(isActive: boolean): void {
  if (!state.isRunning) return;
  if (isActive) {
    state.activeSec++;
  } else {
    state.idleSec++;
  }
}

export function queueTimeEntrySync(): void {
  if (!state.isRunning || !state.startedAt || !state.idempotencyKey) return;

  const durationSec = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
  queueForSync(
    'time_entry',
    {
      idempotencyKey: state.idempotencyKey,
      startedAt: state.startedAt.toISOString(),
      durationSec,
      activeSec: state.activeSec,
      idleSec: state.idleSec,
      activityPct: durationSec > 0 ? Math.round((state.activeSec / durationSec) * 100) : 0,
      status: 'RUNNING',
      projectId: state.projectId,
      taskId: state.taskId,
    },
    state.idempotencyKey
  );
}

function emitTimerUpdate(): void {
  mainWindow?.webContents.send('timer:update', {
    elapsedSec: state.elapsedSec,
    isRunning: state.isRunning,
    projectId: state.projectId,
    taskId: state.taskId,
    activeSec: state.activeSec,
    idleSec: state.idleSec,
    activityPct:
      state.elapsedSec > 0
        ? Math.round((state.activeSec / state.elapsedSec) * 100)
        : 0,
  });
}
