import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, requireRole, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ctx = await validateRequest(req);
    requireRole(ctx, ['ADMIN', 'CLIENT', 'MANAGER']);

    // Get all VA members in this org
    const vaMembers = await prisma.membership.findMany({
      where: { orgId: ctx.orgId, role: 'VA', status: 'ACTIVE' },
      include: { user: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const entries = await Promise.all(
      vaMembers.map(async (member) => {
        const userId = member.userId;

        // Get current running time entry
        const runningEntry = await prisma.timeEntry.findFirst({
          where: { userId, status: 'RUNNING' },
          include: {
            project: { select: { name: true } },
            task: { select: { title: true } },
          },
          orderBy: { startedAt: 'desc' },
        });

        // Get latest activity snapshot
        const latestSnapshot = await prisma.activitySnapshot.findFirst({
          where: { userId, timestamp: { gte: today } },
          orderBy: { timestamp: 'desc' },
        });

        // Get latest window sample
        const latestWindow = await prisma.windowSample.findFirst({
          where: { userId, timestamp: { gte: today } },
          orderBy: { timestamp: 'desc' },
        });

        const isTracking = !!runningEntry;
        let elapsedSec: number | undefined;
        if (runningEntry) {
          elapsedSec = Math.floor(
            (Date.now() - runningEntry.startedAt.getTime()) / 1000
          );
        }

        return {
          userId,
          userName: member.user.name ?? member.user.email,
          avatarUrl: member.user.avatarUrl,
          isTracking,
          currentProject: runningEntry?.project.name,
          currentTask: runningEntry?.task?.title,
          elapsedSec,
          activityPct: latestSnapshot?.activityPct,
          currentApp: latestWindow?.appName,
          lastSyncAt: latestSnapshot?.timestamp.toISOString(),
        };
      })
    );

    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}
