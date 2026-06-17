import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function TeamAffiliateLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getMabizSession();

  if (!ctx) {
    logger.warn('team/affiliate.layout: no session');
    redirect('/sign-in');
  }

  if (ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`team/affiliate.layout: unauthorized - role=${ctx.role}, userId=${ctx.userId}`);
    redirect('/dashboard');
  }

  return <>{children}</>;
}
