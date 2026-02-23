import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ctx = await validateRequest(req);
    const searchParams = req.nextUrl.searchParams;

    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');

    // VA can only query self
    const queryUserId =
      ctx.membership.role === 'VA' ? ctx.user.id : userId ?? ctx.user.id;

    // Verify user is in same org if querying another user
    if (queryUserId !== ctx.user.id) {
      const targetMembership = await prisma.membership.findFirst({
        where: { userId: queryUserId, orgId: ctx.orgId, status: 'ACTIVE' },
      });
      if (!targetMembership) {
        return NextResponse.json({ error: 'User not in your organization' }, { status: 403 });
      }
    }

    const where: Record<string, unknown> = { userId: queryUserId };
    if (startDate) {
      where.startedAt = { ...(where.startedAt as object ?? {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.startedAt = {
        ...(where.startedAt as object ?? {}),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      };
    }
    if (projectId) {
      where.projectId = projectId;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}
