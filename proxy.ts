// ============================================================
// Business OS — Proxy (Next.js 16 edge middleware replacement)
// Verifies our custom JWT cookie on every request.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth/jwt';
import { ALL_SECTIONS } from '@/lib/auth/sections';

// Routes that don't require auth
const PUBLIC_PREFIXES = ['/auth', '/doc/', '/api/auth/login', '/api/auth/seed', '/setup'];

// Map URL path segments to section keys
function sectionFromPath(pathname: string): { mode: 'personal' | 'agency'; section: string } | null {
  const match = pathname.match(/^\/dashboard\/(personal|agency)\/([^/]+)/);
  if (!match) return null;
  return { mode: match[1] as 'personal' | 'agency', section: match[2] };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through immediately
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Read JWT from HttpOnly cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  // ── Not authenticated ──
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // ── Authenticated: redirect root and login page to correct home ──
  if (pathname === '/' || pathname === '/auth/login' || pathname === '/auth') {
    const url = request.nextUrl.clone();
    url.pathname = session.role === 'superadmin'
      ? '/dashboard/personal/home'
      : getDefaultRoute(session);
    return NextResponse.redirect(url);
  }

  // ── Section-level access control for non-superadmin ──
  // NOTE: This logic mirrors userCanAccess() in lib/auth/use-auth.ts.
  // They cannot share code because proxy.ts runs at Edge (no client imports).
  // If you update access logic, update both places.
  if (session.role !== 'superadmin') {
    const target = sectionFromPath(pathname);
    if (target) {
      const allowed = target.mode === 'personal'
        ? session.allowedPersonal
        : session.allowedAgency;

      const hasAccess = allowed !== null && allowed.includes(target.section);

      if (!hasAccess) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const url = request.nextUrl.clone();
        url.pathname = '/403';
        return NextResponse.redirect(url);
      }
    }
  }

  // Forward the verified session as a header for Server Components
  const response = NextResponse.next();
  response.headers.set('x-bos-user-id', session.sub);
  response.headers.set('x-bos-role', session.role);
  return response;
}

function getDefaultRoute(session: { allowedPersonal: string[] | null; allowedAgency: string[] | null }) {
  if (session.allowedPersonal?.length) {
    const first = session.allowedPersonal[0];
    return `/dashboard/personal/${first}`;
  }
  if (session.allowedAgency?.length) {
    const first = session.allowedAgency[0];
    return `/dashboard/agency/${first}`;
  }
  return '/auth/login';
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
