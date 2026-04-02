'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { QuickLogModal } from './QuickLogModal';
import { formatDate } from '@/lib/utils';
import { Zap, Search, Sun, Moon } from 'lucide-react';

export function TopBar() {
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
  const today = formatDate(new Date(), 'EEEE, dd MMMM');

  return (
    <>
      <header
        className="flex items-center gap-3 px-6 bg-surface border-b-subtle sticky top-0 z-50 shrink-0"
        style={{ height: 'var(--topbar-height)' }}
      >
        <span className="t-xs-medium text-secondary whitespace-nowrap">{today}</span>

        {/* Search */}
        <div className="relative ml-2" style={{ flex: 1, maxWidth: 380 }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search clients, documents, leads..."
            className="w-full bg-hover radius-md t-xs text-primary outline-none border border-transparent transition-colors"
            style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7 }}
            onFocus={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; }}
          />
        </div>

        <div className="ml-auto" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-8 h-8 radius-md bg-hover border-subtle text-secondary interactive hover-text-primary shrink-0"
          style={{ border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Quick Log */}
        <button
          onClick={() => setQuickLogOpen(true)}
          className="flex items-center gap-1.5 bg-accent-blue text-white radius-md t-xs font-semibold interactive shrink-0 whitespace-nowrap"
          style={{ padding: '7px 14px', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <Zap size={13} /> Quick Log
        </button>
      </header>

      <QuickLogModal open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
    </>
  );
}
