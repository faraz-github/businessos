// Public endpoint — no auth required.
// Returns the superadmin's personal brand name, logo, and primary colour
// so the login screen can show real branding before the user logs in.
// Only exposes: business_name, logo_url, primary_colour — nothing sensitive.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data: adminUser } = await supabase
      .from('bos_users')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1)
      .single();

    if (!adminUser) return NextResponse.json(null);

    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('business_name, logo_url, primary_colour')
      .eq('user_id', adminUser.id)
      .eq('mode', 'personal')
      .limit(1)
      .single();

    if (!brand) return NextResponse.json(null);

    return NextResponse.json({
      business_name:  brand.business_name  || null,
      logo_url:       brand.logo_url       || null,
      primary_colour: brand.primary_colour || '#4F8EF7',
    });
  } catch {
    return NextResponse.json(null);
  }
}
