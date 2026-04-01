'use client';

import { useState } from 'react';
import { useBrand } from '@/lib/brand';
import { QuickLogModal } from './QuickLogModal';
import { formatDate } from '@/lib/utils';
import { Zap, Search } from 'lucide-react';

export function TopBar() {
  const { brand } = useBrand();
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const today = formatDate(new Date(), 'EEEE, dd MMMM');

  return (
    <>
      <header
        style={{
          height: 'var(--topbar-height)',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Date */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
            whiteSpace: 'nowrap',
          }}
        >
          {today}
        </span>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients, documents, leads..."
            style={{
              width: '100%',
              background: 'var(--bg-hover)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 7,
              paddingBottom: 7,
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'transparent'; }}
          />
        </div>

        <div style={{ marginLeft: 'auto' }} />

        {/* Quick Log Button */}
        <button
          onClick={() => setQuickLogOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'opacity 150ms',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <Zap size={13} />
          Quick Log
        </button>
      </header>

      <QuickLogModal open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
    </>
  );
}
