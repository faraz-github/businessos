import { BrandProvider } from '@/lib/brand';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <div className="flex min-h-screen bg-base">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 p-6 w-full mx-auto" style={{ maxWidth: 'var(--content-max-w)' }}>
            {children}
          </main>
        </div>
      </div>
    </BrandProvider>
  );
}
