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
  console.log('[Sync] Starting sync engine, interval:', config.syncIntervalMs / 1000, 's');

  syncInterval = setInterval(async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      console.log('[Sync] No auth headers — skipping cycle');
      return;
    }

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
  console.log('[Sync] Cycle start — checking outbox...');

  const items = getUnsyncedItems(100);
  if (items.length === 0) {
    console.log('[Sync] Nothing to sync');
    return;
  }

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

  const te = (payload.timeEntries as unknown[]).length;
  const as = (payload.activitySnapshots as unknown[]).length;
  const ws = (payload.windowSamples as unknown[]).length;
  const ss = (payload.screenshots as unknown[]).length;
  console.log('[Sync] Found', items.length, 'pending items (timeEntries:', te, 'snapshots:', as, 'windows:', ws, 'screenshots:', ss, ')');

  // Log first window sample pageTitle for diagnostics
  if (ws > 0) {
    const firstSample = (payload.windowSamples as Array<{ pageTitle?: string | null }>)[0];
    if (firstSample.pageTitle) {
      console.log('[Sync] Window sample includes pageTitle:', JSON.stringify(firstSample.pageTitle));
    }
  }

  const url = `${config.apiBaseUrl}/api/tracker/sync`;
  console.log('[Sync] POSTing to', url, '...');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const responseBody = await res.text();
      console.log('[Sync] ✓ Synced —', responseBody);
      markSynced(syncedKeys);
      console.log('[Sync] Marked', syncedKeys.length, 'rows as synced');
      retryCount = 0;
    } else if (res.status === 401) {
      console.error('[Sync] ✗ Failed — status: 401 (unauthorized)');
    } else {
      const body = await res.text();
      console.error('[Sync] ✗ Failed — status:', res.status, 'body:', body);
      retryCount++;
    }
  } catch (err: any) {
    console.error('[Sync] ✗ Network error:', err.message);
    retryCount++;
  }
}

async function uploadScreenshots(authHeaders: Record<string, string>): Promise<void> {
  const screenshots = getUnuploadedScreenshots(5);

  if (screenshots.length > 0) {
    console.log('[Sync] Found', screenshots.length, 'screenshots to upload');
  }

  for (const ss of screenshots) {
    try {
      const metadata = JSON.parse(ss.metadata);

      // Get presigned URL
      const presignUrl = `${config.apiBaseUrl}/api/tracker/screenshots/presign`;
      console.log('[Screenshot] Requesting presigned URL...');
      const presignRes = await fetch(presignUrl, {
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

      if (!presignRes.ok) {
        console.error('[Screenshot] Presign request failed — status:', presignRes.status);
        continue;
      }

      const { uploadUrl, storagePath, publicUrl } = await presignRes.json();

      // Upload file directly to Supabase Storage via presigned URL
      const fileBuffer = fs.readFileSync(ss.file_path);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: fileBuffer,
      });

      if (!uploadRes.ok) {
        console.error('[Screenshot] Upload FAILED — status:', uploadRes.status);
        continue;
      }

      console.log('[Screenshot] Upload complete —', publicUrl);

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
    } catch (err: any) {
      console.error('[Screenshot] Upload FAILED:', err.message);
    }
  }
}

export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('[Sync] Stopped');
}
