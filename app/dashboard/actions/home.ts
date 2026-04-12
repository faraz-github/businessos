'use server';

import { getSession, getOwnerId } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import type { Mode, AttentionItem, AttentionSeverity } from '@/types';

export async function getAttentionFeed(mode: Mode): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const session = await getSession();
  const user = session ? { id: getOwnerId(session) } : null;
  if (!user) return [];

  const now = new Date();
  const items: AttentionItem[] = [];
  const today = now.toISOString().split('T')[0];
  const sevenDaysStr = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
  const fiveDaysStr  = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];

  // Fetch all 7 signals in parallel
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
      .eq('user_id', user.id).eq('mode', mode).eq('type', 'contract')
      .eq('status', 'sent').is('signed_at', null),
    supabase.from('documents').select('id, title, fields, status')
      .eq('user_id', user.id).eq('mode', mode).eq('type', 'invoice')
      .not('status', 'in', '(paid,signed)'),
    supabase.from('clients').select('id, name, updated_at')
      .eq('user_id', user.id).eq('mode', mode)
      // Exclude post-project stages — these clients no longer need active attention.
      // Stage values match the constraint in migration 006.
      .not('current_stage', 'in', '(handover,deployed,support_active,feedback_sent,retention_sent,completed)'),
    supabase.from('social_posts').select('id, title, planned_date')
      .eq('user_id', user.id).eq('mode', mode)
      .in('status', ['draft', 'scheduled']).lte('planned_date', today),
    supabase.from('documents').select('id, title, created_at, fields')
      .eq('user_id', user.id).eq('mode', mode).eq('type', 'proposal').eq('status', 'sent'),
    supabase.from('subscriptions').select('id, name, cost, next_renewal_at')
      .eq('user_id', user.id).eq('mode', mode).eq('status', 'active')
      .lte('next_renewal_at', sevenDaysStr).gte('next_renewal_at', today),
    supabase.from('support_periods').select('id, client_id, end_date, clients(name)')
      .eq('user_id', user.id).eq('mode', mode)
      .lte('end_date', fiveDaysStr).gte('end_date', today),
  ]);

  const todayStr = today;
  const link = (section: string) => `/dashboard/${mode}/${section}`;

  // 1. Unsigned contracts > 3 days
  unsignedContracts?.forEach((doc) => {
    const daysSent = Math.floor((now.getTime() - new Date(doc.created_at).getTime()) / 86400000);
    if (daysSent >= 3) {
      items.push({ id: `contract-${doc.id}`, type: 'contract_follow_up',
        severity: daysSent >= 7 ? 'critical' : 'important',
        title: 'Contract awaiting signature',
        description: `${doc.title || 'Contract'} sent ${daysSent} day${daysSent !== 1 ? 's' : ''} ago — no signature yet.`,
        link: link('paperwork'), related_id: doc.id, created_at: doc.created_at });
    }
  });

  // 2. Overdue invoices
  invoiceDocs?.forEach((doc) => {
    const f = doc.fields as Record<string, unknown>;
    const dueDate = f?.due_date as string | undefined;
    if (!dueDate || dueDate >= todayStr) return;
    const daysOverdue = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000);
    items.push({ id: `invoice-${doc.id}`, type: 'invoice_overdue', severity: 'critical',
      title: 'Invoice overdue',
      description: `${(f?.invoice_number as string) || doc.title || 'Invoice'} — ₹${Number(f?.total || 0).toLocaleString('en-IN')} overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}.`,
      link: link('finance'), related_id: doc.id, created_at: dueDate });
  });

  // 3. Stale clients — no update in 7+ days
  staleClients?.forEach((client) => {
    const daysSince = Math.floor((now.getTime() - new Date(client.updated_at).getTime()) / 86400000);
    if (daysSince >= 7) {
      items.push({ id: `client-${client.id}`, type: 'client_update', severity: 'important',
        title: `Update ${client.name}`,
        description: `No progress update in ${daysSince} day${daysSince !== 1 ? 's' : ''}.`,
        link: link('clients'), related_id: client.id, created_at: client.updated_at });
    }
  });

  // 4. Posts due today or overdue
  duePosts?.forEach((post) => {
    const isOverdue = post.planned_date < todayStr;
    items.push({ id: `post-${post.id}`, type: 'social_post_due',
      severity: isOverdue ? 'important' : 'info',
      title: isOverdue ? 'Post overdue' : 'Post due today',
      description: post.title || 'Untitled post',
      link: link('social'), related_id: post.id, created_at: post.planned_date });
  });

  // 5. Proposals without response > 5 days + expired validity
  staleProposals?.forEach((doc) => {
    const daysSent = Math.floor((now.getTime() - new Date(doc.created_at).getTime()) / 86400000);
    const fields = doc.fields as Record<string, unknown>;
    const validityDate = fields?.validity_date as string | undefined;
    // Expired validity — higher priority than just stale
    if (validityDate && validityDate < todayStr) {
      items.push({ id: `proposal-expired-${doc.id}`, type: 'proposal_nudge', severity: 'critical',
        title: 'Proposal expired',
        description: `${doc.title || 'Proposal'} validity expired on ${validityDate}.`,
        link: link('paperwork'), related_id: doc.id, created_at: doc.created_at });
    } else if (daysSent >= 5) {
      items.push({ id: `proposal-${doc.id}`, type: 'proposal_nudge', severity: 'important',
        title: 'Proposal needs follow-up',
        description: `${doc.title || 'Proposal'} sent ${daysSent} day${daysSent !== 1 ? 's' : ''} ago.`,
        link: link('paperwork'), related_id: doc.id, created_at: doc.created_at });
    }
  });

  // 6. Subscriptions renewing within 7 days
  renewingSubs?.forEach((sub) => {
    items.push({ id: `sub-${sub.id}`, type: 'subscription_renewal', severity: 'info',
      title: `${sub.name} renewing soon`,
      description: `₹${Number(sub.cost).toLocaleString('en-IN')} on ${sub.next_renewal_at}.`,
      link: link('finance'), related_id: sub.id, created_at: sub.next_renewal_at });
  });

  // 7. Support periods ending within 5 days
  endingSupport?.forEach((sp: any) => {
    items.push({ id: `support-${sp.id}`, type: 'support_ending', severity: 'important',
      title: `Support ending for ${sp.clients?.name || 'client'}`,
      description: `Support period ends on ${sp.end_date}.`,
      link: link('support'), related_id: sp.id, created_at: sp.end_date });
  });

  // Sort: critical first, then important, then info
  const severityOrder: Record<AttentionSeverity, number> = { critical: 0, important: 1, info: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return items;
}

export async function getHomeStats(mode: Mode) {
  const supabase = await createClient();
  const session  = await getSession();
  const user     = session ? { id: getOwnerId(session) } : null;
  if (!user) return null;

  // Single round-trip to the database.
  // Previously 8 sequential queries; now one RPC call.
  // See migration 017_get_home_stats_rpc.sql for the full function.
  const { data, error } = await supabase
    .rpc('get_home_stats', { p_user_id: user.id, p_mode: mode });

  if (error) {
    console.error('[getHomeStats] RPC error:', error.message);
    return null;
  }

  // The RPC returns a JSONB object. Cast it to the expected shape.
  // Null-safe: all numeric fields default to 0, sparklineData to [].
  const d = (data as Record<string, unknown>) ?? {};
  const money   = (d.money   as Record<string, unknown>) ?? {};
  const clients = (d.clients as Record<string, unknown>) ?? {};
  const social  = (d.social  as Record<string, unknown>) ?? {};
  const work    = (d.work    as Record<string, unknown>) ?? {};

  return {
    money: {
      revenueThisMonth: Number(money.revenueThisMonth  ?? 0),
      outstandingTotal: Number(money.outstandingTotal  ?? 0),
      overdueTotal:     Number(money.overdueTotal      ?? 0),
      sparklineData:    (money.sparklineData as { value: number }[]) ?? [],
    },
    clients: {
      activeProjects: Number(clients.activeProjects ?? 0),
      totalActive:    Number(clients.totalActive    ?? 0),
      pipelineLeads:  Number(clients.pipelineLeads  ?? 0),
      totalAllTime:   Number(clients.totalAllTime   ?? 0),
    },
    social: {
      postsThisMonth: Number(social.postsThisMonth ?? 0),
    },
    work: {
      activeProjects:     Number(work.activeProjects     ?? 0),
      deliveredThisMonth: Number(work.deliveredThisMonth ?? 0),
    },
  };
}


export async function getTodaysPriorities(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession();
  const user = session ? { id: getOwnerId(session) } : null;
  if (!user) return [];

  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('priorities')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('date', today)
    .order('sort_order');

  return data || [];
}

export async function getTodaysTimeBlocks(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession();
  const user = session ? { id: getOwnerId(session) } : null;
  if (!user) return [];

  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('date', today)
    .order('start_time');

  return data || [];
}

export async function getRecentLogs(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession();
  const user = session ? { id: getOwnerId(session) } : null;
  if (!user) return [];

  const { data } = await supabase
    .from('quick_logs')
    .select('id, content, created_at')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('created_at', { ascending: false })
    .limit(8);

  return data || [];
}
