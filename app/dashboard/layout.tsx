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
          <main
            className="flex-1 w-full mx-auto"
            style={{
              maxWidth: 'var(--content-max-w)',
              /* top: 36px breathing after topbar, sides: 40px, bottom: 48px */
              /* Top: 6px — heading top aligns with ModeSwitch top (sidebar: 18+30+16=64px, topbar=58px, 64-58=6px) */
              padding: '6px 40px 48px',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </BrandProvider>
  );
}
