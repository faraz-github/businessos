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
    { title: 'Overview', items: [{ label: 'Home', href: `${base}/home`, icon: <Home size={15} /> }] },
    {
      title: 'Work',
      items: [
        { label: 'Social & Brand', href: `${base}/social`, icon: <Share2 size={15} /> },
        { label: 'Composers', href: `${base}/compose`, icon: <PenTool size={15} /> },
        { label: 'Paperwork', href: `${base}/paperwork`, icon: <FileText size={15} /> },
      ],
    },
    {
      title: 'Clients',
      items: [
        { label: 'All Clients', href: `${base}/clients`, icon: <Users size={15} /> },
        { label: 'Feedback', href: `${base}/feedback`, icon: <MessageSquare size={15} /> },
        { label: 'Support', href: `${base}/support`, icon: <Shield size={15} /> },
      ],
    },
    { title: 'Money', items: [{ label: 'Finance', href: `${base}/finance`, icon: <IndianRupee size={15} /> }] },
  ];
}

function getAgencyNav(): SidebarSection[] {
  const base = '/dashboard/agency';
  return [
    {
      title: 'Overview',
      items: [
        { label: 'Home', href: `${base}/home`, icon: <Home size={15} /> },
        { label: 'BD Pipeline', href: `${base}/bd-pipeline`, icon: <Kanban size={15} /> },
      ],
    },
    {
      title: 'Work',
      items: [
        { label: 'Social & Brand', href: `${base}/social`, icon: <Share2 size={15} /> },
        { label: 'Composers', href: `${base}/compose`, icon: <PenTool size={15} /> },
        { label: 'Paperwork', href: `${base}/paperwork`, icon: <FileText size={15} /> },
      ],
    },
    {
      title: 'Clients',
      items: [
        { label: 'All Clients', href: `${base}/clients`, icon: <Users size={15} /> },
        { label: 'Feedback', href: `${base}/feedback`, icon: <MessageSquare size={15} /> },
        { label: 'Support', href: `${base}/support`, icon: <Shield size={15} /> },
      ],
    },
    { title: 'Money', items: [{ label: 'Finance', href: `${base}/finance`, icon: <IndianRupee size={15} /> }] },
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

  const initial = (brand?.business_name || (mode === 'personal' ? 'P' : 'A'))[0].toUpperCase();

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        minHeight: '100vh',
        maxHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '16px 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 12 }}>
          {brand?.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.business_name}
              style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: brand?.primary_colour || 'var(--accent-blue)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {brand?.business_name || (mode === 'personal' ? 'Personal' : 'Agency')}
          </span>
        </div>
        <ModeSwitch />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 12px' }}>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 4 }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                padding: '12px 8px 4px',
                fontFamily: 'var(--font-body)',
              }}
            >
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    fontFamily: 'var(--font-body)',
                    color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--accent-blue-dim)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 150ms',
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
        }}
      >
        <Link
          href="/dashboard/personal/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            transition: 'all 150ms',
            marginBottom: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          <Settings size={15} />
          Brand Settings
        </Link>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
