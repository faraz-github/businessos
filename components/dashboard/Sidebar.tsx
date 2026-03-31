'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBrand } from '@/lib/brand';
import { createClient } from '@/lib/supabase/client';
import { ModeSwitch } from './ModeSwitch';
import { cn } from '@/lib/utils';
import {
  Home, Share2, PenTool, FileText, Users, MessageSquare,
  Shield, IndianRupee, Settings, Kanban, LogOut,
} from 'lucide-react';

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface SidebarSection {
  title: string;
  items: SidebarNavItem[];
}

function getPersonalNav(): SidebarSection[] {
  const base = '/dashboard/personal';
  return [
    {
      title: 'Overview',
      items: [
        { label: 'Home', href: `${base}/home`, icon: <Home size={14} /> },
      ],
    },
    {
      title: 'Work',
      items: [
        { label: 'Social & Brand', href: `${base}/social`, icon: <Share2 size={14} /> },
        { label: 'Composers', href: `${base}/compose`, icon: <PenTool size={14} /> },
        { label: 'Paperwork', href: `${base}/paperwork`, icon: <FileText size={14} /> },
      ],
    },
    {
      title: 'Clients',
      items: [
        { label: 'All Clients', href: `${base}/clients`, icon: <Users size={14} /> },
        { label: 'Feedback', href: `${base}/feedback`, icon: <MessageSquare size={14} /> },
        { label: 'Support', href: `${base}/support`, icon: <Shield size={14} /> },
      ],
    },
    {
      title: 'Money',
      items: [
        { label: 'Finance', href: `${base}/finance`, icon: <IndianRupee size={14} /> },
      ],
    },
  ];
}

function getAgencyNav(): SidebarSection[] {
  const base = '/dashboard/agency';
  return [
    {
      title: 'Overview',
      items: [
        { label: 'Home', href: `${base}/home`, icon: <Home size={14} /> },
        { label: 'BD Pipeline', href: `${base}/bd-pipeline`, icon: <Kanban size={14} /> },
      ],
    },
    {
      title: 'Work',
      items: [
        { label: 'Social & Brand', href: `${base}/social`, icon: <Share2 size={14} /> },
        { label: 'Composers', href: `${base}/compose`, icon: <PenTool size={14} /> },
        { label: 'Paperwork', href: `${base}/paperwork`, icon: <FileText size={14} /> },
      ],
    },
    {
      title: 'Clients',
      items: [
        { label: 'All Clients', href: `${base}/clients`, icon: <Users size={14} /> },
        { label: 'Feedback', href: `${base}/feedback`, icon: <MessageSquare size={14} /> },
        { label: 'Support', href: `${base}/support`, icon: <Shield size={14} /> },
      ],
    },
    {
      title: 'Money',
      items: [
        { label: 'Finance', href: `${base}/finance`, icon: <IndianRupee size={14} /> },
      ],
    },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, brand } = useBrand();
  const sections = mode === 'personal' ? getPersonalNav() : getAgencyNav();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <aside
      className="w-[var(--sidebar-width)] min-h-screen bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex-shrink-0 sticky top-0 flex flex-col"
      style={{ maxHeight: '100vh', overflowY: 'auto' }}
    >
      {/* Brand */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-2 mb-4">
          {brand?.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.business_name}
              className="w-7 h-7 rounded-[var(--radius-sm)] object-cover"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-white text-[11px] font-bold"
              style={{ background: brand?.primary_colour || 'var(--accent-blue)' }}
            >
              {(brand?.business_name || 'B')[0].toUpperCase()}
            </div>
          )}
          <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
            {brand?.business_name || (mode === 'personal' ? 'Personal' : 'Agency')}
          </span>
        </div>
        <ModeSwitch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] px-2 mt-3 mb-1">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-2 py-[7px] rounded-[var(--radius-sm)] text-xs transition-all duration-[var(--duration-fast)] mb-0.5 no-underline',
                    isActive
                      ? 'bg-[var(--accent-blue-dim)] text-[var(--accent-blue)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 mt-auto border-t border-[var(--border-subtle)] pt-3">
        <Link
          href="/dashboard/personal/settings"
          className="flex items-center gap-2 px-2 py-[7px] rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all no-underline"
        >
          <Settings size={14} />
          Brand Settings
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-2 px-2 py-[7px] rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all w-full">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
