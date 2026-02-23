import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';

export async function getServerSession() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });

  if (!dbUser) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: dbUser.id, status: 'ACTIVE' },
  });

  return { user: dbUser, membership };
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!session.membership || !roles.includes(session.membership.role)) {
    redirect('/login');
  }
  return session;
}
