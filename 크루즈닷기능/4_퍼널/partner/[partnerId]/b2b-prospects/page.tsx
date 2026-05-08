// app/partner/[partnerId]/b2b-prospects/page.tsx
// 대리점장 전용 B2B 잠재고객 관리 페이지 (서버 컴포넌트)

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import B2BProspectsClient from './B2BProspectsClient';

interface PageProps {
  params: Promise<{ partnerId: string }>;
}

export default async function B2BProspectsPage({ params }: PageProps) {
  const { partnerId } = await params;

  // 세션 사용자 확인
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  // 파트너 프로필 조회
  const profile = await prisma.affiliateProfile.findFirst({
    where: {
      userId: sessionUser.id,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      type: true,
      User: {
        select: {
          mallUserId: true,
        },
      },
    },
  });

  // 프로필 없으면 로그인으로 리다이렉트
  if (!profile) {
    redirect('/login');
  }

  // mallUserId 확인 (본인 페이지 접근 확인)
  if (profile.User?.mallUserId !== partnerId) {
    redirect('/login');
  }

  // 대리점장(BRANCH_MANAGER)만 접근 가능
  if (profile.type !== 'BRANCH_MANAGER') {
    redirect(`/partner/${partnerId}/dashboard`);
  }

  return <B2BProspectsClient params={{ partnerId }} />;
}
