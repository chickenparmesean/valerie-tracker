import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ctx = await validateApiKey(req);
    const searchParams = req.nextUrl.searchParams;

    const userId = searchParams.get('userId');
    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

    const queryUserId =
      ctx.membership.role === 'VA' ? ctx.user.id : userId ?? ctx.user.id;

    if (queryUserId !== ctx.user.id) {
      const targetMembership = await prisma.membership.findFirst({
        where: { userId: queryUserId, orgId: ctx.orgId, status: 'ACTIVE' },
      });
      if (!targetMembership) {
        return NextResponse.json({ error: 'User not in your organization' }, { status: 403 });
      }
    }

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    const [snapshots, windowSamples] = await Promise.all([
      prisma.activitySnapshot.findMany({
        where: {
          userId: queryUserId,
          timestamp: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.windowSample.findMany({
        where: {
          userId: queryUserId,
          timestamp: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    return NextResponse.json({ snapshots, windowSamples });
  } catch (err) {
    return handleApiError(err);
  }
}
