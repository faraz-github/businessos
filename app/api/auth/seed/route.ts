// POST /api/auth/seed
// Seeds the superadmin from environment variables.
// Safe to call multiple times — uses upsert on email.
//
// PROTECTED: requires x-seed-secret header matching SEED_SECRET env var.
// Set SEED_SECRET to a random string in your .env.local.
// Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Usage: curl -X POST http://localhost:3000/api/auth/seed \
//             -H "x-seed-secret: your-seed-secret"
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin, hashPassword } from '@/lib/auth';

function validateSeedSecret(request: NextRequest): NextResponse | null {
  const seedSecret = process.env.SEED_SECRET;

  if (!seedSecret) {
    // SEED_SECRET not configured — block all seed requests to prevent
    // accidental exposure of the endpoint in production.
    console.error('[seed] SEED_SECRET env var is not set. Seed endpoint is disabled.');
    return NextResponse.json(
      { error: 'Seed endpoint is disabled. Set SEED_SECRET in your environment.' },
      { status: 503 },
    );
  }

  const provided = request.headers.get('x-seed-secret');
  if (!provided || provided !== seedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid x-seed-secret header.' },
      { status: 401 },
    );
  }

  return null; // valid
}

export async function POST(request: NextRequest) {
  const denied = validateSeedSecret(request);
  if (denied) return denied;

  const email    = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name     = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env.local' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'SUPERADMIN_PASSWORD must be at least 8 characters' },
      { status: 400 },
    );
  }

  try {
    const admin        = getSupabaseAdmin();
    const passwordHash = await hashPassword(password);

    // Check if superadmin already exists
    const { data: existing } = await admin
      .from('bos_users')
      .select('id, email')
      .eq('role', 'superadmin')
      .single();

    if (existing) {
      const { error } = await admin
        .from('bos_users')
        .update({ name, email: email.toLowerCase().trim(), password_hash: passwordHash })
        .eq('id', existing.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        action: 'updated',
        message: 'SuperAdmin credentials updated.',
      });
    }

    const { data, error } = await admin
      .from('bos_users')
      .insert({
        name,
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'superadmin',
      })
      .select('id, name, role')
      .single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Table bos_users not found. Run migration 004_custom_auth.sql first.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action: 'created',
      message: `SuperAdmin created. ID: ${data.id}`,
    });

  } catch (err) {
    console.error('[seed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — returns whether superadmin exists, no credentials or emails exposed
export async function GET(request: NextRequest) {
  const denied = validateSeedSecret(request);
  if (denied) return denied;

  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('bos_users')
      .select('id, created_at')
      .eq('role', 'superadmin')
      .single();

    if (data) {
      return NextResponse.json({ seeded: true, created_at: data.created_at });
    }
    return NextResponse.json({
      seeded: false,
      message: 'No superadmin found. POST to this endpoint with x-seed-secret to seed.',
    });
  } catch {
    return NextResponse.json({ seeded: false, error: 'Could not check seed status' });
  }
}
