import { BrandProvider } from '@/lib/brand';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { DashboardErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { ToastContainer } from '@/components/ui/Toast';
import { MobileNavProvider, SidebarBackdrop } from '@/components/dashboard/MobileNavContext';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <MobileNavProvider>
        <div className="flex min-h-screen bg-base">
          <Sidebar />
          {/* Backdrop only visible on tablet/mobile when drawer is open.
              CSS hides it on desktop via the .sidebar-backdrop rules. */}
          <SidebarBackdrop />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar />
            <main
              className="flex-1 w-full mx-auto page-pad"
              style={{ maxWidth: 'var(--content-max-w)' }}
            >
              {/* Client render errors land here. Server/RSC errors land in
                  app/dashboard/error.tsx. Sidebar and TopBar stay mounted
                  because they're outside the boundary. */}
              <DashboardErrorBoundary>
                {children}
              </DashboardErrorBoundary>
            </main>
          </div>
        </div>
        {/* Global toast notifications — rendered outside main content flow */}
        <ToastContainer />
      </MobileNavProvider>
    </BrandProvider>
  );
}
