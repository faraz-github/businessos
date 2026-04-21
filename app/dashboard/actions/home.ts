'use server';
// ============================================================
// Business OS — Home (Dashboard) Server Actions
//
// Consumed by both /dashboard/personal/home and /dashboard/agency/home.
// Everything returned here renders above the fold on the dashboard,
// so performance is a first-class concern: the entire page is one
// `Promise.all` of the actions in this file, and each action is either
// a single DB round-trip or a small parallel fan-out.
//
// Canonical pattern (see subscriptions.ts for the annotated reference):
//   1. requireSession() → throws if not authenticated
//   2. getOwnerId(session) → data-owning superadmin uuid
//   3. No Zod on reads — the input is a trusted `mode` enum from the
//      route shell, not user input
//   4. Return shapes documented inline, matching the client TS types
// ============================================================

import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Mode, AttentionItem, AttentionSeverity } from '@/types';

// ─── HOME STATS ────────────────────────────────────────────────
// Single-RPC implementation. The `get_home_stats` function (see
// supabase/migrations-consolidated/003_functions_and_seed.sql)
// assembles the full payload server-side in one round-trip — replacing
// the 8 sequential queries that the previous JS implementation made.
// Typical saving on a cold connection: ~320 ms → ~40 ms.

export interface HomeStats {
  money: {
    revenueThisMonth: number;
    outstandingTotal: number;
    overdueTotal:     number;
    sparklineData:    { value: number }[];
  };
  clients: {
    activeProjects: number;
    totalActive:    number;
    pipelineLeads:  number;
    totalAllTime:   number;
  };
  social: { postsThisMonth: number };
  work:   { activeProjects: number; deliveredThisMonth: number };
}

/**
 * The shape PostgreSQL returns for the jsonb payload. Numeric columns
 * come back as strings under the hood (Postgres `numeric` preserves
 * precision); we normalise them to `number` before returning so the
 * client can math without `Number(...)` at every call site.
 */
interface RawHomeStats {
  money:   { revenueThisMonth: string | number; outstandingTotal: string | number; overdueTotal: string | number; sparklineData: { value: string | number }[] };
  clients: { activeProjects: number; totalActive: number; pipelineLeads: number; totalAllTime: number };
  social:  { postsThisMonth: number };
  work:    { activeProjects: number; deliveredThisMonth: number };
}

const n = (v: string | number): number => typeof v === 'number' ? v : Number(v);

export async function getHomeStats(mode: Mode): Promise<HomeStats | null> {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_home_stats', {
    p_user_id: ownerId,
    p_mode:    mode,
  });

  if (error) {
    console.error('[home] get_home_stats RPC failed:', error.message);
    return null;
  }
  if (!data) return null;

  // Cast through RawHomeStats — the RPC return type is `Json` in the
  // generated DB types, so we know the shape at the app layer.
  const raw = data as unknown as RawHomeStats;

  return {
    money: {
      revenueThisMonth: n(raw.money.revenueThisMonth),
      outstandingTotal: n(raw.money.outstandingTotal),
      overdueTotal:     n(raw.money.overdueTotal),
      sparklineData:    raw.money.sparklineData.map((p) => ({ value: n(p.value) })),
    },
    clients: raw.clients,
    social:  raw.social,
    work:    raw.work,
  };
}

// ─── ATTENTION FEED ────────────────────────────────────────────
// Seven parallel signals, fan out via Promise.all, assemble + sort in
// JS. Could be a second RPC but the query plans differ substantially
// per signal (different filters, tables, joins), and keeping them in
// JS lets us evolve each check independently.

export async function getAttentionFeed(mode: Mode): Promise<AttentionItem[]> {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const sevenDaysStr = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
  const fiveDaysStr  = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];

  const items: AttentionItem[] = [];

  const [
    { data: unsignedContracts },
    { data: invoiceDocs },
    { data: staleClients },
    { data: duePosts },
    { data: staleProposals },
    { data: renewingSubs },
    { data: endingSupport },
  ] = await Promise.all([
    supabase.from('documents').select('id, title, created_at, client_id')
      .eq('user_id', ownerId).eq('mode', mode).eq('type', 'contract')
      .eq('status', 'sent').is('signed_at', null),
    // Outstanding invoices — sent/viewed/overdue only. Drafts aren't
    // surfaced (the owner hasn't sent them yet, so nothing's owed).
    supabase.from('documents').select('id, title, fields, status')
      .eq('user_id', ownerId).eq('mode', mode).eq('type', 'invoice')
      .in('status', ['sent', 'viewed', 'overdue']),
    supabase.from('clients').select('id, name, updated_at')
      .eq('user_id', ownerId).eq('mode', mode)
      .not('current_stage', 'in', '(completed,delivered,deployed,support_active,feedback_sent,retention_sent)'),
    supabase.from('social_posts').select('id, title, planned_date')
      .eq('user_id', ownerId).eq('mode', mode)
      .in('status', ['draft', 'scheduled']).lte('planned_date', today),
    supabase.from('documents').select('id, title, created_at, fields')
      .eq('user_id', ownerId).eq('mode', mode).eq('type', 'proposal').eq('status', 'sent'),
    supabase.from('subscriptions').select('id, name, cost, next_renewal_at')
      .eq('user_id', ownerId).eq('mode', mode).eq('status', 'active')
      .lte('next_renewal_at', sevenDaysStr).gte('next_renewal_at', today),
    supabase.from('support_periods').select('id, client_id, end_date, clients(name)')
      .eq('user_id', ownerId).eq('mode', mode)
      .lte('end_date', fiveDaysStr).gte('end_date', today),
  ]);

  const link = (section: string) => `/dashboard/${mode}/${section}`;

  // 1. Unsigned contracts > 3 days
  unsignedContracts?.forEach((doc) => {
    const daysSent = Math.floor((now.getTime() - new Date(doc.created_at).getTime()) / 86400000);
    if (daysSent >= 3) {
      items.push({
        id:          `contract-${doc.id}`,
        type:        'contract_follow_up',
        severity:    daysSent >= 7 ? 'critical' : 'important',
        title:       'Contract awaiting signature',
        description: `${doc.title || 'Contract'} sent ${daysSent} day${daysSent !== 1 ? 's' : ''} ago — no signature yet.`,
        link:        link('paperwork'),
        related_id:  doc.id,
        created_at:  doc.created_at,
      });
    }
  });

  // 2. Overdue invoices — belt-and-braces guard on paid_date for when
  //    step 4 lands backdated payment support. An invoice whose status
  //    stays 'sent' but already has a paid_date shouldn't surface.
  invoiceDocs?.forEach((doc) => {
    const f = doc.fields as Record<string, unknown>;
    const dueDate  = f?.due_date  as string | undefined;
    const paidDate = f?.paid_date as string | undefined;
    if (!dueDate || dueDate >= today) return;
    if (paidDate) return;
    const daysOverdue = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000);
    items.push({
      id:          `invoice-${doc.id}`,
      type:        'invoice_overdue',
      severity:    'critical',
      title:       'Invoice overdue',
      description: `${(f?.invoice_number as string) || doc.title || 'Invoice'} — ₹${Number(f?.total || 0).toLocaleString('en-IN')} overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}.`,
      link:        link('finance'),
      related_id:  doc.id,
      created_at:  dueDate,
    });
  });

  // 3. Stale clients — no update in 7+ days
  staleClients?.forEach((client) => {
    const daysSince = Math.floor((now.getTime() - new Date(client.updated_at).getTime()) / 86400000);
    if (daysSince >= 7) {
      items.push({
        id:          `client-${client.id}`,
        type:        'client_update',
        severity:    'important',
        title:       `Update ${client.name}`,
        description: `No progress update in ${daysSince} day${daysSince !== 1 ? 's' : ''}.`,
        link:        link('clients'),
        related_id:  client.id,
        created_at:  client.updated_at,
      });
    }
  });

  // 4. Posts due today or overdue
  duePosts?.forEach((post) => {
    if (!post.planned_date) return;
    const isOverdue = post.planned_date < today;
    items.push({
      id:          `post-${post.id}`,
      type:        'social_post_due',
      severity:    isOverdue ? 'important' : 'info',
      title:       isOverdue ? 'Post overdue' : 'Post due today',
      description: post.title || 'Untitled post',
      link:        link('social'),
      related_id:  post.id,
      created_at:  post.planned_date,
    });
  });

  // 5. Proposals — expired validity (critical) or stale > 5 days (important)
  staleProposals?.forEach((doc) => {
    const daysSent = Math.floor((now.getTime() - new Date(doc.created_at).getTime()) / 86400000);
    const fields = doc.fields as Record<string, unknown>;
    const validityDate = fields?.validity_date as string | undefined;
    if (validityDate && validityDate < today) {
      items.push({
        id:          `proposal-expired-${doc.id}`,
        type:        'proposal_nudge',
        severity:    'critical',
        title:       'Proposal expired',
        description: `${doc.title || 'Proposal'} validity expired on ${validityDate}.`,
        link:        link('paperwork'),
        related_id:  doc.id,
        created_at:  doc.created_at,
      });
    } else if (daysSent >= 5) {
      items.push({
        id:          `proposal-${doc.id}`,
        type:        'proposal_nudge',
        severity:    'important',
        title:       'Proposal needs follow-up',
        description: `${doc.title || 'Proposal'} sent ${daysSent} day${daysSent !== 1 ? 's' : ''} ago.`,
        link:        link('paperwork'),
        related_id:  doc.id,
        created_at:  doc.created_at,
      });
    }
  });

  // 6. Subscriptions renewing within 7 days
  renewingSubs?.forEach((sub) => {
    items.push({
      id:          `sub-${sub.id}`,
      type:        'subscription_renewal',
      severity:    'info',
      title:       `${sub.name} renewing soon`,
      description: `₹${Number(sub.cost).toLocaleString('en-IN')} on ${sub.next_renewal_at}.`,
      link:        link('finance'),
      related_id:  sub.id,
      created_at:  sub.next_renewal_at,
    });
  });

  // 7. Support periods ending within 5 days
  type EndingSupportRow = {
    id:        string;
    end_date:  string;
    clients:   { name: string } | null;
  };
  (endingSupport as EndingSupportRow[] | null)?.forEach((sp) => {
    items.push({
      id:          `support-${sp.id}`,
      type:        'support_ending',
      severity:    'important',
      title:       `Support ending for ${sp.clients?.name ?? 'client'}`,
      description: `Support period ends on ${sp.end_date}.`,
      link:        link('support'),
      related_id:  sp.id,
      created_at:  sp.end_date,
    });
  });

  const severityOrder: Record<AttentionSeverity, number> = {
    critical: 0, important: 1, info: 2,
  };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return items;
}

// ─── TODAY'S PRIORITIES / TIME BLOCKS / RECENT LOGS ───────────
// Small, single-query reads. Return empty arrays on no-data rather than
// null — the consuming UI is list-shaped.

export async function getTodaysPriorities(mode: Mode) {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('priorities')
    .select('*')
    .eq('user_id', ownerId)
    .eq('mode', mode)
    .eq('date', today)
    .order('sort_order');

  if (error) {
    console.error('[home] getTodaysPriorities failed:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getTodaysTimeBlocks(mode: Mode) {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', ownerId)
    .eq('mode', mode)
    .eq('date', today)
    .order('start_time');

  if (error) {
    console.error('[home] getTodaysTimeBlocks failed:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getRecentLogs(mode: Mode) {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('quick_logs')
    .select('id, content, created_at')
    .eq('user_id', ownerId)
    .eq('mode', mode)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('[home] getRecentLogs failed:', error.message);
    return [];
  }
  return data ?? [];
}
