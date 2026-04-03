'use server';

import { getSession } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import type { Mode, AttentionItem, AttentionSeverity } from '@/types';

export async function getAttentionFeed(mode: Mode): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const now = new Date();
  const items: AttentionItem[] = [];
  const baseUrl = `/dashboard/${mode}`;

  // 1. Contracts sent > 3 days ago with no signature
  const { data: unsignedContracts } = await supabase
    .from('documents')
    .select('id, title, created_at, client_id')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('type', 'contract')
    .eq('status', 'sent')
    .is('signed_at', null);

  unsignedContracts?.forEach((doc) => {
    const daysSent = Math.floor((now.getTime() - new Date(doc.created_at).getTime()) / 86400000);
    if (daysSent >= 3) {
      items.push({
        id: `contract-${doc.id}`,
        type: 'contract_follow_up',
        severity: daysSent >= 7 ? 'critical' : 'important',
        title: 'Contract awaiting signature',
        description: `${doc.title || 'Contract'} sent ${daysSent} days ago — no signature yet.`,
        link: `${baseUrl}/paperwork`,
        related_id: doc.id,
        created_at: doc.created_at,
      });
    }
  });

  // 2. Overdue invoices
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, number, total, due_date, client_id')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .in('status', ['sent', 'viewed', 'overdue'])
    .lt('due_date', now.toISOString().split('T')[0]);

  overdueInvoices?.forEach((inv) => {
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
    items.push({
      id: `invoice-${inv.id}`,
      type: 'invoice_overdue',
      severity: 'critical',
      title: `Invoice ${inv.number} overdue`,
      description: `₹${inv.total.toLocaleString('en-IN')} overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}.`,
      link: `${baseUrl}/finance`,
      related_id: inv.id,
      created_at: inv.due_date,
    });
  });

  // 3. Clients with no update in 7+ days
  const { data: staleClients } = await supabase
    .from('clients')
    .select('id, name, updated_at')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .not('current_stage', 'in', '("completed","delivered","deployed")');

  staleClients?.forEach((client) => {
    const daysSince = Math.floor((now.getTime() - new Date(client.updated_at).getTime()) / 86400000);
    if (daysSince >= 7) {
      items.push({
        id: `client-${client.id}`,
        type: 'client_update',
        severity: 'important',
        title: `Update ${client.name}`,
        description: `No progress update in ${daysSince} days.`,
        link: `${baseUrl}/clients`,
        related_id: client.id,
        created_at: client.updated_at,
      });
    }
  });

  // 4. Social posts due today or overdue
  const todayStr = now.toISOString().split('T')[0];
  const { data: duePosts } = await supabase
    .from('social_posts')
    .select('id, title, planned_date')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .in('status', ['draft', 'scheduled'])
    .lte('planned_date', todayStr);

  duePosts?.forEach((post) => {
    const isOverdue = post.planned_date < todayStr;
    items.push({
      id: `post-${post.id}`,
      type: 'social_post_due',
      severity: isOverdue ? 'important' : 'info',
      title: isOverdue ? 'Post overdue' : 'Post due today',
      description: post.title || 'Untitled post',
      link: `${baseUrl}/social`,
      related_id: post.id,
      created_at: post.planned_date,
    });
  });

  // 5. Proposals sent > 5 days with no response
  const { data: staleProposals } = await supabase
    .from('documents')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('type', 'proposal')
    .eq('status', 'sent');

  staleProposals?.forEach((doc) => {
    const daysSent = Math.floor((now.getTime() - new Date(doc.created_at).getTime()) / 86400000);
    if (daysSent >= 5) {
      items.push({
        id: `proposal-${doc.id}`,
        type: 'proposal_nudge',
        severity: 'important',
        title: 'Proposal needs follow-up',
        description: `${doc.title || 'Proposal'} sent ${daysSent} days ago.`,
        link: `${baseUrl}/paperwork`,
        related_id: doc.id,
        created_at: doc.created_at,
      });
    }
  });

  // 6. Subscriptions renewing within 7 days
  const sevenDays = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
  const { data: renewingSubs } = await supabase
    .from('subscriptions')
    .select('id, name, cost, next_renewal_at')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('status', 'active')
    .lte('next_renewal_at', sevenDays)
    .gte('next_renewal_at', todayStr);

  renewingSubs?.forEach((sub) => {
    items.push({
      id: `sub-${sub.id}`,
      type: 'subscription_renewal',
      severity: 'info',
      title: `${sub.name} renewing soon`,
      description: `₹${sub.cost.toLocaleString('en-IN')} on ${sub.next_renewal_at}.`,
      link: `${baseUrl}/finance`,
      related_id: sub.id,
      created_at: sub.next_renewal_at,
    });
  });

  // 7. Support periods ending within 5 days
  const fiveDays = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];
  const { data: endingSupport } = await supabase
    .from('support_periods')
    .select('id, client_id, end_date, clients(name)')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .lte('end_date', fiveDays)
    .gte('end_date', todayStr);

  endingSupport?.forEach((sp: any) => {
    items.push({
      id: `support-${sp.id}`,
      type: 'support_ending',
      severity: 'important',
      title: `Support ending for ${sp.clients?.name || 'client'}`,
      description: `Support period ends on ${sp.end_date}.`,
      link: `${baseUrl}/support`,
      related_id: sp.id,
      created_at: sp.end_date,
    });
  });

  // Sort: critical first, then important, then info
  const severityOrder: Record<AttentionSeverity, number> = { critical: 0, important: 1, info: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return items;
}

export async function getHomeStats(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  // Revenue this month
  const { data: monthIncome } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('type', 'income')
    .gte('date', startOfMonth);

  const revenueThisMonth = monthIncome?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Outstanding invoices
  const { data: outstandingInv } = await supabase
    .from('invoices')
    .select('total')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .in('status', ['sent', 'viewed']);

  const outstandingTotal = outstandingInv?.reduce((sum, i) => sum + Number(i.total), 0) || 0;

  // Overdue invoices
  const { data: overdueInv } = await supabase
    .from('invoices')
    .select('total')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .in('status', ['sent', 'viewed', 'overdue'])
    .lt('due_date', now.toISOString().split('T')[0]);

  const overdueTotal = overdueInv?.reduce((sum, i) => sum + Number(i.total), 0) || 0;

  // Client counts
  const { data: activeClients } = await supabase
    .from('clients')
    .select('id, current_stage')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .not('current_stage', 'in', '("completed")');

  const { count: totalClients } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('mode', mode);

  const { count: pipelineLeads } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('mode', mode)
    .not('stage', 'in', '("closed_won","closed_lost")');

  // Posts this month
  const { count: postsThisMonth } = await supabase
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('status', 'published')
    .gte('planned_date', startOfMonth);

  // Active projects (clients in work stages)
  const workStages = ['work_in_progress', 'phase_1_complete', 'phase_2_complete', 'review_and_feedback', 'revisions_complete'];
  const activeProjectsCount = activeClients?.filter((c) => workStages.includes(c.current_stage)).length || 0;

  // Delivered this month — clients whose stage_history contains 'delivered' or 'completed' entered this month
  const { data: recentlyDelivered } = await supabase
    .from('clients')
    .select('stage_history')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .in('current_stage', ['delivered', 'deployed', 'support_period_active', 'completed']);

  const deliveredThisMonth = recentlyDelivered?.filter((c) => {
    const history = (c.stage_history as { stage: string; entered_at: string }[]) || [];
    return history.some(
      (h) =>
        (h.stage === 'delivered' || h.stage === 'completed') &&
        h.entered_at >= startOfMonth,
    );
  }).length || 0;

  // 5-month revenue sparkline — single query, aggregate in JS
  const fiveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 4, 1).toISOString().split('T')[0];
  const { data: allSparklineTx } = await supabase
    .from('transactions')
    .select('amount, date')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('type', 'income')
    .gte('date', fiveMonthsAgo);

  const sparklineData = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    const monthStart = d.toISOString().split('T')[0];
    const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0];
    const value = allSparklineTx
      ?.filter(t => t.date >= monthStart && t.date < monthEnd)
      .reduce((s, t) => s + Number(t.amount), 0) || 0;
    return { value };
  });

  return {
    money: {
      revenueThisMonth,
      outstandingTotal,
      overdueTotal,
      sparklineData,
    },
    clients: {
      activeProjects: activeProjectsCount,
      totalActive: activeClients?.length || 0,
      pipelineLeads: pipelineLeads || 0,
      totalAllTime: totalClients || 0,
    },
    social: {
      postsThisMonth: postsThisMonth || 0,
    },
    work: {
      activeProjects: activeProjectsCount,
      deliveredThisMonth,
    },
  };
}

export async function getTodaysPriorities(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
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
  const session = await getSession(); const user = session ? { id: session.sub } : null;
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
