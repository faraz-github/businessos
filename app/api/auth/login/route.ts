// POST /api/auth/login
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin, verifyPassword, signToken, COOKIE_NAME, EXPIRY_SECONDS } from '@/lib/auth';
import type { BosUserRow } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Verify env vars are set before attempting DB query
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[auth/login] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (!process.env.JWT_SECRET) {
      console.error('[auth/login] JWT_SECRET is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const admin = getSupabaseAdmin();

    // Fetch user by email
    const { data: user, error: dbError } = await admin
      .from('bos_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single<BosUserRow>();

    if (dbError) {
      // Table doesn't exist yet — migration hasn't been run
      if (dbError.code === '42P01') {
        console.error('[auth/login] bos_users table not found. Run migration 004_custom_auth.sql');
        return NextResponse.json(
          { error: 'Auth system not initialised. Run migration 004_custom_auth.sql in Supabase.' },
          { status: 503 }
        );
      }
      console.error('[auth/login] DB error:', dbError.code, dbError.message);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      console.error('[auth/login] Password mismatch for:', email);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Resolve ownerId — the superadmin's user_id that owns all the data.
    // For superadmin: ownerId = their own id.
    // For admin: ownerId = the superadmin who created them (created_by field).
    let ownerId = user.id;
    if (user.role !== 'superadmin' && user.created_by) {
      ownerId = user.created_by;
    } else if (user.role !== 'superadmin') {
      // Fallback: find the superadmin if created_by not set
      const { data: sa } = await admin
        .from('bos_users')
        .select('id')
        .eq('role', 'superadmin')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (sa) ownerId = sa.id;
    }

    // Sign JWT
    const token = await signToken({
      sub: user.id,
      ownerId,
      email: user.email,
      name: user.name,
      role: user.role,
      allowedPersonal: user.allowed_personal,
      allowedAgency: user.allowed_agency,
    });

    // Update last_login_at (fire and forget)
    admin.from('bos_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {});

    // Set HttpOnly cookie
    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        ownerId,
        name: user.name,
        email: user.email,
        role: user.role,
        allowedPersonal: user.allowed_personal,
        allowedAgency:   user.allowed_agency,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: EXPIRY_SECONDS,
      path: '/',
    });

    return response;

  } catch (err) {
    console.error('[auth/login] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
