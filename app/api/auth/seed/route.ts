// ============================================================
// POST /api/auth/seed
// Seeds the superadmin from environment variables.
// Idempotent — re-running updates the existing superadmin's
// name/email/password from the env vars.
//
// PROTECTED: requires `x-seed-secret` header matching SEED_SECRET
// env var. Without SEED_SECRET configured, the endpoint returns
// 503 (disabled) — this prevents anyone who discovers /api/auth/seed
// on a deployed instance from creating or hijacking the superadmin.
//
// Generate a secret:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// CLI usage:
//   curl -X POST http://localhost:3000/api/auth/seed \
//        -H "x-seed-secret: <your-seed-secret>"
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin, hashPassword } from '@/lib/auth';

/**
 * Validates the `x-seed-secret` header against `SEED_SECRET` env var.
 * Returns null when valid, or a NextResponse to short-circuit when not.
 *
 * Uses constant-time comparison to avoid leaking length/prefix info via
 * response timing (relevant because this endpoint can be probed remotely).
 */
function validateSeedSecret(request: NextRequest): NextResponse | null {
  const seedSecret = process.env.SEED_SECRET;

  if (!seedSecret) {
    console.error('[seed] SEED_SECRET env var is not set. Seed endpoint is disabled.');
    return NextResponse.json(
      { error: 'Seed endpoint is disabled. Set SEED_SECRET in your environment.' },
      { status: 503 },
    );
  }

  const provided = request.headers.get('x-seed-secret') ?? '';
  if (!constantTimeEqual(provided, seedSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid x-seed-secret header.' },
      { status: 401 },
    );
  }

  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  // Length-mismatched compares are intentionally still done over the longer
  // string to avoid an early-exit timing channel.
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const admin           = getSupabaseAdmin();
    const passwordHash    = await hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();

    // Look up existing superadmin (only one is supported per install).
    const { data: existing, error: lookupError } = await admin
      .from('bos_users')
      .select('id, email')
      .eq('role', 'superadmin')
      .maybeSingle();

    if (lookupError) {
      if (lookupError.code === '42P01') {
        return NextResponse.json(
          { error: 'Table bos_users not found. Run migration 004_custom_auth.sql first.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (existing) {
      const { error } = await admin
        .from('bos_users')
        .update({ name, email: normalizedEmail, password_hash: passwordHash })
        .eq('id', existing.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        action: 'updated' as const,
        message: `SuperAdmin credentials updated for ${normalizedEmail}`,
      });
    }

    const { data, error } = await admin
      .from('bos_users')
      .insert({
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'superadmin',
      })
      .select('id, name, email, role')
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
      action: 'created' as const,
      message: `SuperAdmin created: ${data.email}`,
    });
  } catch (err) {
    console.error('[seed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET — health check. Returns whether a superadmin row exists.
 * Also requires the seed secret so the endpoint can't be used as
 * a "is this a Business OS install?" probe by unauthenticated callers.
 *
 * Returns no email or other identifying info, only existence + timestamp.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = validateSeedSecret(request);
  if (denied) return denied;

  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('bos_users')
      .select('id, created_at')
      .eq('role', 'superadmin')
      .maybeSingle();

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
