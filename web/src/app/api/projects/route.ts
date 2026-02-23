import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest, requireRole, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  requireTask: z.boolean().optional(),
  color: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await validateRequest(req);
    const status = req.nextUrl.searchParams.get('status') || 'ACTIVE';

    const projects = await prisma.project.findMany({
      where: {
        orgId: ctx.orgId,
        status: status as 'ACTIVE' | 'ARCHIVED',
      },
      include: {
        tasks: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            sortOrder: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await validateRequest(req);
    requireRole(ctx, ['ADMIN', 'CLIENT']);

    const body = await req.json();
    const parsed = createProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        requireTask: parsed.requireTask ?? false,
        color: parsed.color,
        orgId: ctx.orgId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
