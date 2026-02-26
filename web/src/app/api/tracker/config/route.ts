import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function handleGetConfig(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  });

  if (!membership) {
    return null;
  }

  const org = membership.organization;

  return {
    userId,
    orgId: membership.orgId,
    screenshotFreq: org.screenshotFreq,
    idleTimeoutMin: org.idleTimeoutMin,
    blurScreenshots: org.blurScreenshots,
    trackApps: org.trackApps,
    trackUrls: org.trackUrls,
  };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await validateApiKey(req);
    const config = await handleGetConfig(ctx.user.id);

    if (!config) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 404 },
      );
    }

    return NextResponse.json(config);
  } catch (err) {
    return handleApiError(err);
  }
}
