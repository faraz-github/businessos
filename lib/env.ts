// ============================================================
// Business OS — Environment Variable Validation
// Validated once at module load time. Any missing required var
// throws immediately with a clear message rather than a cryptic
// runtime crash inside a request handler.
// Import this at the top of lib/auth/index.ts and lib/supabase/server.ts
// ============================================================

const required = {
  NEXT_PUBLIC_SUPABASE_URL:    process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:   process.env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET:                  process.env.JWT_SECRET,
} as const;

// Only validate on the server side (service vars are not available in browser)
if (typeof window === 'undefined') {
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `[BusinessOS] Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
      `Copy .env.example to .env.local and fill in the values.`
    );
  }
}

export const env = {
  supabaseUrl:          process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey:      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRole:  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  jwtSecret:            process.env.JWT_SECRET!,
  nodeEnv:              process.env.NODE_ENV ?? 'development',
} as const;
