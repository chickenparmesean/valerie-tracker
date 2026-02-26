import { NextResponse } from 'next/server';
import { prisma } from './prisma';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  membership: {
    id: string;
    role: string;
    orgId: string;
  };
  orgId: string;
}

export async function validateApiKey(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer vt_')) {
    throw new AuthError('Missing or invalid API key', 401);
  }

  const apiKey = authHeader.slice(7);

  const user = await prisma.user.findFirst({
    where: { trackerApiKey: apiKey },
  });

  if (!user) {
    throw new AuthError('Invalid API key', 401);
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
  });

  if (!membership) {
    throw new AuthError('No active membership found', 403);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    membership: {
      id: membership.id,
      role: membership.role,
      orgId: membership.orgId,
    },
    orgId: membership.orgId,
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('API error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
