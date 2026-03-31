'use client';

import { BrandProvider } from '@/lib/brand';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Mode } from '@/types';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const initialMode: Mode = pathname.includes('/agency') ? 'agency' : 'personal';

  return (
    <BrandProvider initialMode={initialMode}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 p-6 max-w-[var(--content-max-w)] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </BrandProvider>
  );
}
