'use client';

import { useState } from 'react';
import { useBrand } from '@/lib/brand';
import { QuickLogModal } from './QuickLogModal';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Zap, Search } from 'lucide-react';

export function TopBar() {
  const { brand, mode } = useBrand();
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const today = formatDate(new Date(), 'EEEE, dd MMMM');

  return (
    <>
      <header className="h-[var(--topbar-height)] bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center px-6 gap-4 sticky top-0 z-50">
        {/* Date */}
        <span className="text-[13px] text-[var(--text-secondary)] font-medium">{today}</span>

        {/* Search */}
        <div className="flex-1 max-w-md mx-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients, documents, leads..."
            className="w-full bg-[var(--bg-hover)] border border-transparent rounded-[var(--radius-md)] pl-9 pr-3 py-[7px] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--border-default)] transition-colors"
          />
        </div>

        {/* Quick Log */}
        <Button
          variant="primary"
          size="sm"
          icon={<Zap size={12} />}
          onClick={() => setQuickLogOpen(true)}
        >
          Quick Log
        </Button>
      </header>

      <QuickLogModal open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
    </>
  );
}
