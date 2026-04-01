import { BrandProvider } from '@/lib/brand';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <main style={{ flex: 1, padding: 24, maxWidth: 'var(--content-max-w)', width: '100%', margin: '0 auto' }}>
            {children}
          </main>
        </div>
      </div>
    </BrandProvider>
  );
}
