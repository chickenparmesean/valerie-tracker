export interface SyncPayload {
  timeEntries: SyncTimeEntry[];
  activitySnapshots: SyncActivitySnapshot[];
  windowSamples: SyncWindowSample[];
  screenshots: SyncScreenshotMeta[];
}

export interface SyncTimeEntry {
  idempotencyKey: string;
  startedAt: string;
  stoppedAt?: string;
  durationSec?: number;
  activeSec?: number;
  idleSec?: number;
  activityPct?: number;
  status: string;
  note?: string;
  projectId: string;
  taskId?: string;
}

export interface SyncActivitySnapshot {
  idempotencyKey: string;
  timestamp: string;
  intervalSec: number;
  activityPct: number;
  keyboardPct?: number;
  mousePct?: number;
  timeEntryId: string;
}

export interface SyncWindowSample {
  idempotencyKey: string;
  timestamp: string;
  appName: string;
  windowTitle?: string;
  processPath?: string;
  durationSec: number;
  timeEntryId: string;
}

export interface SyncScreenshotMeta {
  idempotencyKey: string;
  capturedAt: string;
  storageUrl: string;
  storagePath: string;
  activityPct?: number;
  activeApp?: string;
  activeTitle?: string;
  fileSizeBytes?: number;
  timeEntryId: string;
}

export interface SyncResponse {
  synced: boolean;
  counts: {
    timeEntries: number;
    activitySnapshots: number;
    windowSamples: number;
    screenshots: number;
  };
}
