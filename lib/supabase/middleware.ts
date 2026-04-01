// ============================================================
// Business OS — Supabase middleware helper (DEPRECATED)
// Auth is now handled by our custom JWT layer in proxy.ts.
// This file is kept to avoid breaking any residual imports.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}
