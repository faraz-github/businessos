import { redirect } from 'next/navigation';

export default function RootPage() {
  // proxy.ts handles authenticated users — redirects them to their correct home.
  // Unauthenticated users hitting / will be caught by proxy and sent to /auth/login.
  redirect('/auth/login');
}
