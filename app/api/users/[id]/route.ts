// PATCH /api/users/[id] — update name, email, password, role, access, active status
// DELETE /api/users/[id] — deactivate (soft delete)
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getSupabaseAdmin, hashPassword } from '@/lib/auth';
import type { Database } from '@/types/database';

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
  const { name, email, role, allowedPersonal, allowedAgency, isActive, password } = body as {
    name?: string;
    email?: string;
    role?: string;
    allowedPersonal?: string[] | null;
    allowedAgency?: string[] | null;
    isActive?: boolean;
    password?: string;
  };

  const admin = getSupabaseAdmin();

  // Fetch target user to check their role
  const { data: target } = await admin
    .from('bos_users')
    .select('role')
    .eq('id', id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Superadmin editing another superadmin is blocked
  if (target.role === 'superadmin' && id !== session!.sub) {
    return NextResponse.json({ error: 'Cannot modify another superadmin' }, { status: 403 });
  }

  // Superadmin cannot downgrade their own role
  if (id === session!.sub && role && role !== 'superadmin') {
    return NextResponse.json({ error: 'Cannot change superadmin role' }, { status: 400 });
  }

  const updates: Database['public']['Tables']['bos_users']['Update'] = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.toLowerCase().trim();
  if (role !== undefined && role !== 'superadmin') updates.role = role as 'admin';
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
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Prevent deleting another superadmin
  const { data: target } = await admin.from('bos_users').select('role').eq('id', id).single();
  if (target?.role === 'superadmin') {
    return NextResponse.json({ error: 'Cannot delete a superadmin account' }, { status: 403 });
  }

  const { error } = await admin
    .from('bos_users')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
