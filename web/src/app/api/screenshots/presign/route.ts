import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey, handleApiError } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { format } from 'date-fns';

const presignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  orgId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await validateApiKey(req);
    const body = await req.json();
    const parsed = presignSchema.parse(body);

    const dateFolder = format(new Date(), 'yyyy-MM-dd');
    const fileId = randomUUID();
    const storagePath = `${parsed.orgId}/${ctx.user.id}/${dateFolder}/${fileId}.webp`;

    const supabase = createServiceClient();
    const { data, error } = await supabase.storage
      .from('screenshots')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create signed URL' },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      storagePath,
      publicUrl: publicData.publicUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
