import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, handleApiError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const ctx = await validateApiKey(req);
    return NextResponse.json({ status: 'ok', userId: ctx.user.id });
  } catch (err) {
    return handleApiError(err);
  }
}
