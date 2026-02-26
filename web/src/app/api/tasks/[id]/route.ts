import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey, handleApiError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
  description: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await validateApiKey(req);
    const { id: taskId } = await params;

    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task || task.project.orgId !== ctx.orgId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateTaskSchema.parse(body);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: parsed,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
