'use client';

import { PersonalHomeClient } from '@/app/dashboard/personal/home/client';
import { Card } from '@/components/ui/Card';
import { Kanban, TrendingUp } from 'lucide-react';
import type { AttentionItem, Priority, TimeBlock } from '@/types';

interface AgencyHomeClientProps {
  attentionItems: AttentionItem[];
  stats: {
    money: {
      revenueThisMonth: number;
      outstandingTotal: number;
      overdueTotal: number;
      sparklineData: { value: number }[];
    };
    clients: {
      activeProjects: number;
      totalActive: number;
      pipelineLeads: number;
      totalAllTime: number;
    };
    social: { postsThisMonth: number };
    work: { activeProjects: number; deliveredThisMonth: number };
  } | null;
  priorities: Priority[];
  timeBlocks: TimeBlock[];
  bdStats: { leadsThisWeek: number; movedForward: number };
}

export function AgencyHomeClient({
  attentionItems,
  stats,
  priorities,
  timeBlocks,
  bdStats,
}: AgencyHomeClientProps) {
  return (
    // No PageTransition here — PersonalHomeClient already wraps in PageTransition
    <div className="flex flex-col gap-6">
      {/* BD Activity Zone */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-3">
          BD Activity This Week
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Card variant="metric">
            <div className="flex items-center gap-2 mb-2">
              <Kanban size={14} className="text-[var(--accent-violet)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">
                New Leads
              </span>
            </div>
            <p className="t-h1">
              {bdStats.leadsThisWeek}
            </p>
          </Card>
          <Card variant="metric">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-[var(--accent-green)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">
                Moved Forward
              </span>
            </div>
            <p className="t-h1">
              {bdStats.movedForward}
            </p>
          </Card>
        </div>
      </div>

      {/* Reuse the personal home layout for the rest */}
      <PersonalHomeClient
        attentionItems={attentionItems}
        stats={stats}
        priorities={priorities}
        timeBlocks={timeBlocks}
      />
    </div>
  );
}
