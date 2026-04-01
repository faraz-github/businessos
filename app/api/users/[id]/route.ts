// PATCH /api/users/[id] — update name, role, access, active status
// PUT   /api/users/[id]/password — reset password (superadmin only)
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getSupabaseAdmin, hashPassword } from '@/lib/auth';

function requireSuperAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const { name, role, allowedPersonal, allowedAgency, isActive, password } = body as {
    name?: string;
    role?: string;
    allowedPersonal?: string[] | null;
    allowedAgency?: string[] | null;
    isActive?: boolean;
    password?: string;
  };

  // Prevent modifying superadmin
  const admin = getSupabaseAdmin();
  const { data: target } = await admin
    .from('bos_users')
    .select('role')
    .eq('id', id)
    .single();

  if (target?.role === 'superadmin' && id !== session!.sub) {
    return NextResponse.json({ error: 'Cannot modify another superadmin' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined && role !== 'superadmin') updates.role = role;
  if (allowedPersonal !== undefined) updates.allowed_personal = allowedPersonal;
  if (allowedAgency !== undefined) updates.allowed_agency = allowedAgency;
  if (isActive !== undefined) updates.is_active = isActive;
  if (password) updates.password_hash = await hashPassword(password);

  const { data, error } = await admin
    .from('bos_users')
    .update(updates)
    .eq('id', id)
    .select('id, name, email, role, allowed_personal, allowed_agency, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const { id } = await params;

  if (id === session!.sub) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('bos_users')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
