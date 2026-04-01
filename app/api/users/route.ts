// GET  /api/users       — list all team members (superadmin only)
// POST /api/users       — create a team member (superadmin only)
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getSupabaseAdmin, hashPassword } from '@/lib/auth';
import type { BosUserRow } from '@/lib/auth';

function requireSuperAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('bos_users')
    .select('id, name, email, role, allowed_personal, allowed_agency, is_active, last_login_at, created_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const body = await request.json();
  const { name, email, password, role, allowedPersonal, allowedAgency } = body as {
    name: string;
    email: string;
    password: string;
    role: 'admin';
    allowedPersonal: string[] | null;
    allowedAgency: string[] | null;
  };

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'name, email, password, role are required' }, { status: 400 });
  }

  if (!['admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Only "admin" can be created.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('bos_users')
    .insert({
      name,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      role,
      allowed_personal: allowedPersonal,
      allowed_agency: allowedAgency,
      created_by: session!.sub,
    })
    .select('id, name, email, role, allowed_personal, allowed_agency, is_active, created_at')
    .single<BosUserRow>();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
