import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import MyContractClient from './MyContractClient';

export default async function PartnerContractPage({ params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect('/partner');
    }

    // 관리자 체크
    const isAdmin = sessionUser.role === 'admin';

    // 관리자가 아닌 경우, 본인 확인 필요
    if (!isAdmin) {
      const { profile } = await requirePartnerContext();

      // 본인의 mallUserId와 일치하는지 확인
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/contract`);
      }
    } else {
      // 관리자는 해당 mallUserId의 사용자가 존재하는지만 확인
      const targetUser = await prisma.user.findFirst({
        where: { mallUserId: partnerId },
        select: { id: true },
      });

      if (!targetUser) {
        redirect('/partner');
      }
    }

    return <MyContractClient partnerId={partnerId} />;
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}

