import fs from 'fs';
import {
  getUnsyncedItems,
  markSynced,
  getUnuploadedScreenshots,
  markScreenshotUploaded,
  queueForSync,
} from './database';
import { getAuthHeaders } from './auth';
import { queueTimeEntrySync, getTimerState } from './timer';
import { config } from './config';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let retryCount = 0;
const MAX_BACKOFF_MS = 300_000; // 5 minutes

export function startSyncEngine(): void {
  syncInterval = setInterval(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    // Sync running time entry before batch
    const timerState = getTimerState();
    if (timerState.isRunning) {
      queueTimeEntrySync();
    }

    await syncBatch(headers);
    await uploadScreenshots(headers);
  }, config.syncIntervalMs);
}

async function syncBatch(authHeaders: Record<string, string>): Promise<void> {
  const items = getUnsyncedItems(100);
  if (items.length === 0) return;

  // Group by type
  const payload: Record<string, unknown[]> = {
    timeEntries: [],
    activitySnapshots: [],
    windowSamples: [],
    screenshots: [],
  };

  const typeMap: Record<string, string> = {
    time_entry: 'timeEntries',
    activity_snapshot: 'activitySnapshots',
    window_sample: 'windowSamples',
    screenshot: 'screenshots',
  };

  const syncedKeys: string[] = [];

  for (const item of items) {
    const key = typeMap[item.type];
    if (key) {
      payload[key].push(JSON.parse(item.payload));
      syncedKeys.push(item.idempotency_key);
    }
  }

  try {
    const res = await fetch(`${config.apiBaseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      markSynced(syncedKeys);
      retryCount = 0;
    } else if (res.status === 401) {
      console.error('Sync: 401 unauthorized');
    } else {
      console.error('Sync failed:', res.status);
      retryCount++;
    }
  } catch (err) {
    console.error('Sync network error:', err);
    retryCount++;
  }
}

async function uploadScreenshots(authHeaders: Record<string, string>): Promise<void> {
  const screenshots = getUnuploadedScreenshots(5);

  for (const ss of screenshots) {
    try {
      const metadata = JSON.parse(ss.metadata);

      // Get presigned URL
      const presignRes = await fetch(`${config.apiBaseUrl}/api/screenshots/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          fileName: `${ss.idempotency_key}.webp`,
          contentType: 'image/webp',
          orgId: 'default',
        }),
      });

      if (!presignRes.ok) continue;

      const { uploadUrl, storagePath, publicUrl } = await presignRes.json();

      // Upload file directly to Supabase Storage via presigned URL
      const fileBuffer = fs.readFileSync(ss.file_path);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: fileBuffer,
      });

      if (!uploadRes.ok) continue;

      // Queue screenshot metadata for sync
      queueForSync(
        'screenshot',
        {
          ...metadata,
          storageUrl: publicUrl,
          storagePath,
        },
        ss.idempotency_key
      );

      markScreenshotUploaded(ss.idempotency_key);

      // Delete local file
      try {
        fs.unlinkSync(ss.file_path);
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Screenshot upload failed:', err);
    }
  }
}

export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
