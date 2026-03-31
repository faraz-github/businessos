import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAttentionFeed, getHomeStats, getTodaysPriorities, getTodaysTimeBlocks } from '@/app/dashboard/actions/home';
import { PersonalHomeClient } from './client';

export default async function PersonalHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [attentionItems, stats, priorities, timeBlocks] = await Promise.all([
    getAttentionFeed('personal'),
    getHomeStats('personal'),
    getTodaysPriorities('personal'),
    getTodaysTimeBlocks('personal'),
  ]);

  return (
    <PersonalHomeClient
      attentionItems={attentionItems}
      stats={stats}
      priorities={priorities}
      timeBlocks={timeBlocks}
    />
  );
}
