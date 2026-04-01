'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/auth';

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  redirect('/auth/login');
}
