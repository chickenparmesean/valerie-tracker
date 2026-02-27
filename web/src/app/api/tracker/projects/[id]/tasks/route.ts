import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await validateApiKey(req);
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: ctx.orgId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createTaskSchema.parse(body);

    const maxOrder = await prisma.task.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });

    const task = await prisma.task.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        projectId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
