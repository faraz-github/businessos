'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBrand } from '@/lib/brand';
import { useCurrentUser, userCanAccess } from '@/lib/auth/use-auth';
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
      { label: 'Social & Brand', href: `${b}/social`, icon: <Share2 size={15} />, section: 'social' },
      { label: 'Composers',     href: `${b}/compose`, icon: <PenTool size={15} />, section: 'compose' },
      { label: 'Paperwork',     href: `${b}/paperwork`, icon: <FileText size={15} />, section: 'paperwork' },
    ]},
    { title: 'Clients', items: [
      { label: 'All Clients', href: `${b}/clients`, icon: <Users size={15} />, section: 'clients' },
      { label: 'Feedback',    href: `${b}/feedback`, icon: <MessageSquare size={15} />, section: 'feedback' },
      { label: 'Support',     href: `${b}/support`, icon: <Shield size={15} />, section: 'support' },
    ]},
    { title: 'Money', items: [{ label: 'Finance', href: `${b}/finance`, icon: <IndianRupee size={15} />, section: 'finance' }] },
  ];
}

function getAgencyNav(): NavSection[] {
  const b = '/dashboard/agency';
  return [
    { title: 'Overview', items: [
      { label: 'Home',        href: `${b}/home`, icon: <Home size={15} />, section: 'home' },
      { label: 'BD Pipeline', href: `${b}/bd-pipeline`, icon: <Kanban size={15} />, section: 'bd-pipeline' },
    ]},
    { title: 'Work', items: [
      { label: 'Social & Brand', href: `${b}/social`, icon: <Share2 size={15} />, section: 'social' },
      { label: 'Composers',     href: `${b}/compose`, icon: <PenTool size={15} />, section: 'compose' },
      { label: 'Paperwork',     href: `${b}/paperwork`, icon: <FileText size={15} />, section: 'paperwork' },
    ]},
    { title: 'Clients', items: [
      { label: 'All Clients', href: `${b}/clients`, icon: <Users size={15} />, section: 'clients' },
      { label: 'Feedback',    href: `${b}/feedback`, icon: <MessageSquare size={15} />, section: 'feedback' },
      { label: 'Support',     href: `${b}/support`, icon: <Shield size={15} />, section: 'support' },
    ]},
    { title: 'Money', items: [{ label: 'Finance', href: `${b}/finance`, icon: <IndianRupee size={15} />, section: 'finance' }] },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, brand } = useBrand();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role === 'superadmin';

  const allSections = mode === 'personal' ? getPersonalNav() : getAgencyNav();
  const sections = allSections.map(sec => ({
    ...sec,
    items: sec.items.filter(item => isSuperAdmin || userCanAccess(user, mode, item.section)),
  })).filter(sec => sec.items.length > 0);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  }

  const initial = (brand?.business_name || (mode === 'personal' ? 'P' : 'A'))[0].toUpperCase();

  return (
    <aside className="flex flex-col bg-surface border-r border-subtle shrink-0 sticky top-0 overflow-y-auto"
      style={{ width: 'var(--sidebar-width)', minHeight: '100vh', maxHeight: '100vh' }}>

      {/* Brand header */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2.5 px-1.5 mb-3">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.business_name}
              className="w-7 h-7 radius-sm object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 radius-sm flex items-center justify-center text-white shrink-0"
              style={{ background: brand?.primary_colour || 'var(--accent-blue)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {initial}
            </div>
          )}
          <span className="t-sm-semibold truncate">
            {brand?.business_name || (mode === 'personal' ? 'Personal' : 'Agency')}
          </span>
        </div>

        {isSuperAdmin && <ModeSwitch />}
        {!isSuperAdmin && (
          <div className="px-2 py-1.5 bg-accent-blue-dim radius-sm text-center t-label text-accent-blue">
            {mode === 'agency' ? 'Agency Access' : 'Personal Access'}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-1 pb-2">
        {sections.map(section => (
          <div key={section.title} className="mb-1">
            <p className="t-label-xs px-2 pt-3 pb-1">{section.title}</p>
            {section.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2 px-2 py-[7px] radius-sm t-xs mb-0.5 no-underline transition-colors ${
                    active
                      ? 'bg-accent-blue-dim text-accent-blue font-medium'
                      : 'text-secondary hover-bg-hover hover-text-primary'
                  }`}>
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t-subtle pt-3">
        {isSuperAdmin && (
          <Link href="/dashboard/personal/settings"
            className="flex items-center gap-2 px-2 py-[7px] radius-sm t-xs text-secondary no-underline transition-colors hover-bg-hover hover-text-primary mb-0.5">
            <Settings size={15} /> Brand Settings
          </Link>
        )}
        {isSuperAdmin && (
          <Link href="/dashboard/personal/settings?tab=team"
            className="flex items-center gap-2 px-2 py-[7px] radius-sm t-xs text-secondary no-underline transition-colors hover-bg-hover hover-text-primary mb-0.5">
            <UserCog size={15} /> Team & Access
          </Link>
        )}

        {/* User identity */}
        {user && (
          <div className="flex items-center gap-2 px-2 py-2 mb-0.5">
            <div className="w-[22px] h-[22px] rounded-full bg-accent-blue-dim border-accent-blue flex items-center justify-center shrink-0"
              className="t-label text-accent-blue">
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="t-xs-medium text-primary truncate">{user.name}</p>
              <p className="t-role">
                {user.role === 'superadmin' ? 'Super Admin' : user.role}
              </p>
            </div>
          </div>
        )}

        <button onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-2 py-[7px] radius-sm t-xs text-secondary transition-colors hover-bg-hover hover-text-red"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
