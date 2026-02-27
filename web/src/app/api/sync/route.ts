import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const syncTimeEntrySchema = z.object({
  idempotencyKey: z.string().uuid(),
  startedAt: z.string().datetime(),
  stoppedAt: z.string().datetime().optional(),
  durationSec: z.number().int().optional(),
  activeSec: z.number().int().optional(),
  idleSec: z.number().int().optional(),
  activityPct: z.number().int().min(0).max(100).optional(),
  status: z.enum(['RUNNING', 'STOPPED', 'IDLE_PAUSED', 'SYNCED']),
  note: z.string().optional(),
  projectId: z.string().min(1),
taskId: z.string().nullable().optional(),
});

const syncActivitySnapshotSchema = z.object({
  idempotencyKey: z.string().uuid(),
  timestamp: z.string().datetime(),
  intervalSec: z.number().int(),
  activityPct: z.number().int().min(0).max(100),
  keyboardPct: z.number().int().min(0).max(100).optional(),
  mousePct: z.number().int().min(0).max(100).optional(),
  timeEntryId: z.string().min(1),
});

const syncWindowSampleSchema = z.object({
  idempotencyKey: z.string().uuid(),
  timestamp: z.string().datetime(),
  appName: z.string().min(1),
  windowTitle: z.string().optional(),
  processPath: z.string().optional(),
  durationSec: z.number().int(),
  timeEntryId: z.string().min(1),
});

const syncScreenshotMetaSchema = z.object({
  idempotencyKey: z.string().uuid(),
  capturedAt: z.string().datetime(),
  storageUrl: z.string().url(),
  storagePath: z.string().min(1),
  activityPct: z.number().int().min(0).max(100).optional(),
  activeApp: z.string().optional(),
  activeTitle: z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  timeEntryId: z.string().min(1),
});

const syncPayloadSchema = z.object({
  timeEntries: z.array(syncTimeEntrySchema).default([]),
  activitySnapshots: z.array(syncActivitySnapshotSchema).default([]),
  windowSamples: z.array(syncWindowSampleSchema).default([]),
  screenshots: z.array(syncScreenshotMetaSchema).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await validateApiKey(req);

    const body = await req.json();
    const payload = syncPayloadSchema.parse(body);

    const counts = { timeEntries: 0, activitySnapshots: 0, windowSamples: 0, screenshots: 0 };

    await prisma.$transaction(async (tx) => {
      // Upsert time entries (they get updated as timer runs)
      for (const entry of payload.timeEntries) {
        await tx.timeEntry.upsert({
          where: { idempotencyKey: entry.idempotencyKey },
          create: {
            idempotencyKey: entry.idempotencyKey,
            startedAt: new Date(entry.startedAt),
            stoppedAt: entry.stoppedAt ? new Date(entry.stoppedAt) : undefined,
            durationSec: entry.durationSec,
            activeSec: entry.activeSec,
            idleSec: entry.idleSec,
            activityPct: entry.activityPct,
            status: entry.status as 'RUNNING' | 'STOPPED' | 'IDLE_PAUSED' | 'SYNCED',
            note: entry.note,
            userId: ctx.user.id,
            projectId: entry.projectId,
            taskId: entry.taskId || undefined,
          },
          update: {
            stoppedAt: entry.stoppedAt ? new Date(entry.stoppedAt) : undefined,
            durationSec: entry.durationSec,
            activeSec: entry.activeSec,
            idleSec: entry.idleSec,
            activityPct: entry.activityPct,
            status: entry.status as 'RUNNING' | 'STOPPED' | 'IDLE_PAUSED' | 'SYNCED',
            note: entry.note,
          },
        });
        counts.timeEntries++;
      }

      // Insert activity snapshots (skip duplicates)
      if (payload.activitySnapshots.length > 0) {
        const result = await tx.activitySnapshot.createMany({
          data: payload.activitySnapshots.map((s) => ({
            idempotencyKey: s.idempotencyKey,
            timestamp: new Date(s.timestamp),
            intervalSec: s.intervalSec,
            activityPct: s.activityPct,
            keyboardPct: s.keyboardPct,
            mousePct: s.mousePct,
            userId: ctx.user.id,
            timeEntryId: s.timeEntryId,
          })),
          skipDuplicates: true,
        });
        counts.activitySnapshots = result.count;
      }

      // Insert window samples (skip duplicates)
      if (payload.windowSamples.length > 0) {
        const result = await tx.windowSample.createMany({
          data: payload.windowSamples.map((w) => ({
            idempotencyKey: w.idempotencyKey,
            timestamp: new Date(w.timestamp),
            appName: w.appName,
            windowTitle: w.windowTitle,
            processPath: w.processPath,
            durationSec: w.durationSec,
            userId: ctx.user.id,
            timeEntryId: w.timeEntryId,
          })),
          skipDuplicates: true,
        });
        counts.windowSamples = result.count;
      }

      // Insert screenshot metadata (skip duplicates)
      if (payload.screenshots.length > 0) {
        const result = await tx.screenshot.createMany({
          data: payload.screenshots.map((s) => ({
            idempotencyKey: s.idempotencyKey,
            capturedAt: new Date(s.capturedAt),
            storageUrl: s.storageUrl,
            storagePath: s.storagePath,
            activityPct: s.activityPct,
            activeApp: s.activeApp,
            activeTitle: s.activeTitle,
            fileSizeBytes: s.fileSizeBytes,
            userId: ctx.user.id,
            timeEntryId: s.timeEntryId,
          })),
          skipDuplicates: true,
        });
        counts.screenshots = result.count;
      }
    });

    return NextResponse.json({ synced: true, counts });
  } catch (err) {
    return handleApiError(err);
  }
}
