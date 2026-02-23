import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from './supabase-server';
import { prisma } from './prisma';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    supabaseId: string;
    name: string | null;
  };
  membership: {
    id: string;
    role: string;
    orgId: string;
  };
  orgId: string;
}

export async function validateRequest(req: NextRequest): Promise<AuthContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);
  const supabase = createServiceClient();
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

  if (error || !supabaseUser) {
    throw new AuthError('Invalid or expired token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (!user) {
    throw new AuthError('User not found', 404);
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
      supabaseId: user.supabaseId,
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

export function requireRole(ctx: AuthContext, roles: string[]): void {
  if (!roles.includes(ctx.membership.role)) {
    throw new AuthError('Insufficient permissions', 403);
  }
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
