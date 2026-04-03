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
        className="flex items-center gap-4 bg-surface shrink-0 sticky top-0 z-50"
        style={{
          height: 'var(--topbar-height)',
          padding: '0 40px 0 40px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Date */}
        <span style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
        }}>
          {today}
        </span>

        {/* Search */}
        <div className="relative" style={{ flex: 1, maxWidth: 400, marginLeft: 8 }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search clients, documents, leads..."
            className="w-full bg-hover radius-md interactive outline-none"
            style={{
              padding: '8px 12px 8px 32px',
              border: '1px solid transparent',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; }}
          />
        </div>

        <div className="ml-auto" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center bg-hover radius-md interactive shrink-0"
          style={{
            width: 34, height: 34,
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Quick Log — explicit white text, no t-xs color override */}
        <button
          onClick={() => setQuickLogOpen(true)}
          className="flex items-center gap-1.5 bg-accent-blue radius-md interactive shrink-0 whitespace-nowrap"
          style={{
            padding: '8px 16px',
            border: 'none',
            cursor: 'pointer',
            /* Always white text — inline wins over any CSS class color */
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
          }}
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
