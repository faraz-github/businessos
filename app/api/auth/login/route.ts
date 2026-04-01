// POST /api/auth/login
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin, verifyPassword, signToken, COOKIE_NAME, EXPIRY_SECONDS } from '@/lib/auth';
import type { BosUserRow } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch user by email
    const { data: user, error } = await admin
      .from('bos_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single<BosUserRow>();

    if (error || !user) {
      // Generic message — don't reveal whether email exists
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Sign JWT
    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      allowedPersonal: user.allowed_personal,
      allowedAgency: user.allowed_agency,
    });

    // Update last_login_at
    await admin
      .from('bos_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Set HttpOnly cookie
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
