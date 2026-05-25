import { getMabizSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Menu47ReactivationDashboard from '@/components/menu-47-reactivation-dashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Menu #47: 부재중 고객 재활성화 | 마비즈 CRM',
  description: 'L0 렌즈 - 6개월+ 부재 고객을 62-97% 재예약율로 유도',
};

export default async function Menu47Page() {
  const session = await getMabizSession();

  if (!session?.organizationId) {
    redirect('/login');
  }

  return <Menu47ReactivationDashboard organizationId={session.organizationId} />;
}
