import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, requireRole, handleApiError } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await validateRequest(req);
    requireRole(ctx, ['VA']);

    const { id: screenshotId } = await params;

    const screenshot = await prisma.screenshot.findFirst({
      where: { id: screenshotId, userId: ctx.user.id, deletedByUser: false },
    });

    if (!screenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
    }

    // Only allow deletion within 24 hours
    const hoursSinceCapture =
      (Date.now() - screenshot.capturedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCapture > 24) {
      return NextResponse.json(
        { error: 'Screenshots can only be deleted within 24 hours of capture' },
        { status: 403 }
      );
    }

    // Soft delete in DB
    await prisma.screenshot.update({
      where: { id: screenshotId },
      data: { deletedByUser: true, deletedAt: new Date() },
    });

    // Delete from storage
    const supabase = createServiceClient();
    await supabase.storage.from('screenshots').remove([screenshot.storagePath]);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
