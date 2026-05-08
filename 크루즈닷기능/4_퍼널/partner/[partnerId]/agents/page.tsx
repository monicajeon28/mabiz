import { redirect } from 'next/navigation';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import AgentsManagement from './AgentsManagement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgentsPage({ params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect('/partner');
    }

    // 파트너 컨텍스트 확인 (관리된 판매원 포함)
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });

    // 대리점장만 접근 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      redirect(`/partner/${partnerId}/dashboard`);
    }

    // 본인의 페이지인지 확인
    if (profile.User?.mallUserId !== partnerId) {
      redirect(`/partner/${profile.User?.mallUserId ?? ''}/agents`);
    }

    return <AgentsManagement partnerId={partnerId} profile={profile} />;
  } catch (error) {
    console.error('Agents page error:', error);
    redirect('/partner');
  }
}
