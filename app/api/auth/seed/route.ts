// POST /api/auth/seed
// Seeds the superadmin from environment variables.
// Safe to call multiple times — uses upsert on email.
// Protected: only runs if SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are set.
// Call once after deployment: curl -X POST http://localhost:3000/api/auth/seed
import { NextResponse } from 'next/server';
import { getSupabaseAdmin, hashPassword } from '@/lib/auth';

export async function POST() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env.local' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'SUPERADMIN_PASSWORD must be at least 8 characters' },
      { status: 400 }
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const passwordHash = await hashPassword(password);

    // Check if superadmin already exists
    const { data: existing } = await admin
      .from('bos_users')
      .select('id, email')
      .eq('role', 'superadmin')
      .single();

    if (existing) {
      // Update existing superadmin's credentials
      const { error } = await admin
        .from('bos_users')
        .update({ name, email: email.toLowerCase().trim(), password_hash: passwordHash })
        .eq('id', existing.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        action: 'updated',
        message: `SuperAdmin credentials updated for ${email}`,
      });
    }

    // Insert fresh superadmin
    const { data, error } = await admin
      .from('bos_users')
      .insert({
        name,
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'superadmin',
      })
      .select('id, name, email, role')
      .single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Table bos_users not found. Run migration 004_custom_auth.sql first.' },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action: 'created',
      message: `SuperAdmin created: ${data.email}`,
    });

  } catch (err) {
    console.error('[seed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — health check to see if superadmin exists (no auth needed, no sensitive data)
export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('bos_users')
      .select('id, email, created_at')
      .eq('role', 'superadmin')
      .single();

    if (data) {
      return NextResponse.json({ seeded: true, email: data.email });
    }
    return NextResponse.json({ seeded: false, message: 'No superadmin found. POST to this endpoint to seed.' });
  } catch {
    return NextResponse.json({ seeded: false, error: 'Could not check seed status' });
  }
}
