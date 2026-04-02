#!/usr/bin/env tsx
// ============================================================
// Business OS — SuperAdmin Seed Script
// Run with: pnpm seed
// Safe to run multiple times. Uses SUPERADMIN_* env vars.
// Works locally and in Vercel/Railway build steps.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Load .env.local in development
async function loadEnv() {
  try {
    const { config } = await import('dotenv');
    config({ path: '.env.local' });
  } catch {
    // dotenv not available — env vars already set (production)
  }
}

async function seed() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || 'Super Admin';

  // Validate
  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!email) missing.push('SUPERADMIN_EMAIL');
  if (!password) missing.push('SUPERADMIN_PASSWORD');

  if (missing.length) {
    console.error('❌  Missing environment variables:');
    missing.forEach(v => console.error(`   • ${v}`));
    console.error('\nAdd them to .env.local and try again.');
    process.exit(1);
  }

  if (password!.length < 8) {
    console.error('❌  SUPERADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  console.log('🔗  Connecting to Supabase...');
  const admin = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check table exists
  const { error: tableErr } = await admin
    .from('bos_users')
    .select('id')
    .limit(1);

  if (tableErr?.code === '42P01') {
    console.error('❌  Table bos_users not found.');
    console.error('   Run migration 004_custom_auth.sql in Supabase SQL editor first.');
    process.exit(1);
  }

  console.log('🔐  Hashing password...');
  const passwordHash = await bcrypt.hash(password!, 12);

  // Check if superadmin already exists
  const { data: existing } = await admin
    .from('bos_users')
    .select('id, email')
    .eq('role', 'superadmin')
    .maybeSingle();

  if (existing) {
    console.log(`📝  Updating existing superadmin (${existing.email})...`);
    const { error } = await admin
      .from('bos_users')
      .update({
        name,
        email: email!.toLowerCase().trim(),
        password_hash: passwordHash,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('❌  Failed to update:', error.message);
      process.exit(1);
    }
    console.log('✅  SuperAdmin updated successfully.');
    console.log(`   Email:    ${email}`);
    console.log(`   Name:     ${name}`);
    console.log(`   Password: [set from SUPERADMIN_PASSWORD]`);
  } else {
    console.log('➕  Creating superadmin...');
    const { error } = await admin
      .from('bos_users')
      .insert({
        name,
        email: email!.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'superadmin',
      });

    if (error) {
      console.error('❌  Failed to create:', error.message);
      process.exit(1);
    }
    console.log('✅  SuperAdmin created successfully.');
    console.log(`   Email:    ${email}`);
    console.log(`   Name:     ${name}`);
    console.log(`   Password: [set from SUPERADMIN_PASSWORD]`);
  }

  console.log('\n🎉  Done! You can now sign in at /auth/login');
}

seed().catch(err => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
