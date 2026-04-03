'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBrand } from '@/lib/brand';
import { useCurrentUser, userCanAccess, clearUserCache } from '@/lib/auth/use-auth';
import { ModeSwitch } from './ModeSwitch';
import {
  Home, Share2, PenTool, FileText, Users, MessageSquare,
  Shield, IndianRupee, Settings, Kanban, LogOut, UserCog,
} from 'lucide-react';

interface NavItem { label: string; href: string; icon: React.ReactNode; section: string; }
interface NavSection { title: string; items: NavItem[]; }

function getPersonalNav(): NavSection[] {
  const b = '/dashboard/personal';
  return [
    { title: 'Overview', items: [{ label: 'Home', href: `${b}/home`, icon: <Home size={15} />, section: 'home' }] },
    { title: 'Work', items: [
      { label: 'Social & Brand', href: `${b}/social`,    icon: <Share2 size={15} />,   section: 'social' },
      { label: 'Composers',     href: `${b}/compose`,   icon: <PenTool size={15} />,  section: 'compose' },
      { label: 'Paperwork',     href: `${b}/paperwork`, icon: <FileText size={15} />, section: 'paperwork' },
    ]},
    { title: 'Clients', items: [
      { label: 'All Clients', href: `${b}/clients`,  icon: <Users size={15} />,         section: 'clients' },
      { label: 'Feedback',    href: `${b}/feedback`, icon: <MessageSquare size={15} />, section: 'feedback' },
      { label: 'Support',     href: `${b}/support`,  icon: <Shield size={15} />,        section: 'support' },
    ]},
    { title: 'Money', items: [{ label: 'Finance', href: `${b}/finance`, icon: <IndianRupee size={15} />, section: 'finance' }] },
  ];
}

function getAgencyNav(): NavSection[] {
  const b = '/dashboard/agency';
  return [
    { title: 'Overview', items: [
      { label: 'Home',        href: `${b}/home`,        icon: <Home size={15} />,   section: 'home' },
      { label: 'BD Pipeline', href: `${b}/bd-pipeline`, icon: <Kanban size={15} />, section: 'bd-pipeline' },
    ]},
    { title: 'Work', items: [
      { label: 'Social & Brand', href: `${b}/social`,    icon: <Share2 size={15} />,   section: 'social' },
      { label: 'Composers',     href: `${b}/compose`,   icon: <PenTool size={15} />,  section: 'compose' },
      { label: 'Paperwork',     href: `${b}/paperwork`, icon: <FileText size={15} />, section: 'paperwork' },
    ]},
    { title: 'Clients', items: [
      { label: 'All Clients', href: `${b}/clients`,  icon: <Users size={15} />,         section: 'clients' },
      { label: 'Feedback',    href: `${b}/feedback`, icon: <MessageSquare size={15} />, section: 'feedback' },
      { label: 'Support',     href: `${b}/support`,  icon: <Shield size={15} />,        section: 'support' },
    ]},
    { title: 'Money', items: [{ label: 'Finance', href: `${b}/finance`, icon: <IndianRupee size={15} />, section: 'finance' }] },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { mode, brand } = useBrand();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role === 'superadmin';

  const allSections = mode === 'personal' ? getPersonalNav() : getAgencyNav();
  const sections = allSections
    .map(sec => ({ ...sec, items: sec.items.filter(item => isSuperAdmin || userCanAccess(user, mode, item.section)) }))
    .filter(sec => sec.items.length > 0);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearUserCache();   // clear module-level cache so next login starts fresh
    router.push('/auth/login');
    router.refresh();
  }

  const initial = (brand?.business_name || (mode === 'personal' ? 'P' : 'A'))[0].toUpperCase();

  return (
    <aside
      className="flex flex-col bg-surface shrink-0 sticky top-0 overflow-y-auto"
      style={{
        width: 'var(--sidebar-width)',
        minHeight: '100vh',
        maxHeight: '100vh',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Brand row: same left padding + height as topbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        height: 'var(--topbar-height)',  /* exactly matches topbar height */
        flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {brand?.logo_url ? (
          <img src={brand.logo_url} alt={brand.business_name}
            className="shrink-0 radius-sm object-cover"
            style={{ width: 26, height: 26 }} />
        ) : (
          <div className="flex items-center justify-center shrink-0 radius-sm"
            style={{
              width: 26, height: 26,
              background: brand?.primary_colour || 'var(--accent-blue)',
              color: '#fff', fontSize: 12,
              fontFamily: 'var(--font-display)', fontWeight: 700,
            }}>
            {initial}
          </div>
        )}
        <span className="t-sm-semibold truncate">
          {brand?.business_name || (mode === 'personal' ? 'Personal' : 'Agency')}
        </span>
      </div>

      {/* ── ModeSwitch: sits flush below brand row, aligned with content top ── */}
      {isSuperAdmin && (
        <div style={{ padding: '6px 12px 2px' }}>
          <ModeSwitch />
        </div>
      )}
      {!isSuperAdmin && (
        <div style={{ padding: '6px 12px 2px' }}>
          <div className="radius-sm bg-accent-blue-dim text-center t-label text-accent-blue"
            style={{ padding: '6px 10px' }}>
            {mode === 'agency' ? 'Agency Access' : 'Personal Access'}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '0 12px 16px' }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 4 }}>
            <p className="t-label-xs" style={{ padding: '12px 8px 6px' }}>{section.title}</p>
            {section.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-2.5 radius-sm interactive no-underline',
                    active
                      ? 'bg-accent-blue-dim text-accent-blue'
                      : 'text-secondary hover-bg-hover hover-text-primary',
                  ].join(' ')}
                  style={{
                    padding: '8px 10px',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    fontWeight: active ? 500 : 400,
                    marginBottom: 2,
                  }}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        {isSuperAdmin && (
          <>
            <Link href="/dashboard/personal/settings"
              className="flex items-center gap-2.5 radius-sm t-xs text-secondary interactive no-underline hover-bg-hover hover-text-primary"
              style={{ padding: '8px 10px', marginBottom: 2 }}>
              <Settings size={14} /> Brand Settings
            </Link>
            <Link href="/dashboard/personal/settings?tab=team"
              className="flex items-center gap-2.5 radius-sm t-xs text-secondary interactive no-underline hover-bg-hover hover-text-primary"
              style={{ padding: '8px 10px', marginBottom: 8 }}>
              <UserCog size={14} /> Team & Access
            </Link>
          </>
        )}

        {user && (
          <div className="flex items-center gap-2.5" style={{ padding: '6px 10px', marginBottom: 4 }}>
            <div
              className="flex items-center justify-center rounded-full shrink-0 bg-accent-blue-dim"
              style={{ width: 24, height: 24, fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-blue)' }}
            >
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="t-xs-medium text-primary truncate">{user.name}</p>
              <p className="t-role">{user.role === 'superadmin' ? 'Super Admin' : user.role}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full radius-sm t-xs text-secondary interactive hover-bg-hover hover-text-red"
          style={{ padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
