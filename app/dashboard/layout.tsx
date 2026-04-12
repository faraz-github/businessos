import { BrandProvider } from '@/lib/brand';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { ToastContainer } from '@/components/ui/Toast';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <div className="flex min-h-screen bg-base">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main
            className="flex-1 w-full mx-auto"
            style={{
              maxWidth: 'var(--content-max-w)',
              padding: '28px 40px 48px',
            }}
          >
            {children}
          </main>
        </div>
      </div>
      {/* Global toast notifications — rendered outside main content flow */}
      <ToastContainer />
    </BrandProvider>
  );
}
