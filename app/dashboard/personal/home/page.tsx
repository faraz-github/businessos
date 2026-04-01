import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAttentionFeed, getHomeStats, getTodaysPriorities, getTodaysTimeBlocks } from '@/app/dashboard/actions/home';
import { PersonalHomeClient } from './client';

export default async function PersonalHomePage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');
  const user = { id: session.sub };

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
