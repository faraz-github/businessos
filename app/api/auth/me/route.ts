// GET /api/auth/me — returns current session user (for client components)
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({
    id: session.sub,
    ownerId: session.ownerId ?? session.sub, // fallback for existing sessions
    name: session.name,
    email: session.email,
    role: session.role,
    allowedPersonal: session.allowedPersonal,
    allowedAgency: session.allowedAgency,
  });
}
