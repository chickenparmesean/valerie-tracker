import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest, requireRole, handleApiError } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  orgId: z.string().min(1),
  role: z.enum(['ADMIN', 'CLIENT', 'MANAGER', 'VA']),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await validateRequest(req);
    requireRole(ctx, ['ADMIN']);

    const body = await req.json();
    const parsed = registerSchema.parse(body);

    const supabase = createServiceClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Failed to create auth user' },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        supabaseId: authData.user.id,
      },
    });

    await prisma.membership.create({
      data: {
        userId: user.id,
        orgId: parsed.orgId,
        role: parsed.role,
      },
    });

    return NextResponse.json(
      { userId: user.id, email: user.email, supabaseId: user.supabaseId },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
