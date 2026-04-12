import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAttentionFeed, getHomeStats, getTodaysPriorities, getTodaysTimeBlocks, getRecentLogs } from '@/app/dashboard/actions/home';
import { AgencyHomeClient } from './client';

export default async function AgencyHomePage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const supabase = await createClient();

  const [attentionItems, stats, priorities, timeBlocks, recentLogs] = await Promise.all([
    getAttentionFeed('agency'),
    getHomeStats('agency'),
    getTodaysPriorities('agency'),
    getTodaysTimeBlocks('agency'),
    getRecentLogs('agency'),
  ]);

  // BD-specific stats
  const now = new Date();
  const startOfWeek = new Date(now.getTime() - now.getDay() * 86400000).toISOString().split('T')[0];

  const { data: weekLeads } = await supabase
    .from('leads')
    .select('id, stage, last_activity_at')
    .eq('user_id', session.sub)
    .eq('mode', 'agency')
    .gte('last_activity_at', startOfWeek);

  const bdStats = {
    leadsThisWeek: weekLeads?.length || 0,
    movedForward: weekLeads?.filter((l: { stage: string }) => l.stage !== 'prospect').length || 0,
  };

  return (
    <AgencyHomeClient
      attentionItems={attentionItems}
      stats={stats}
      priorities={priorities}
      timeBlocks={timeBlocks}
      recentLogs={recentLogs}
      bdStats={bdStats}
    />
  );
}
