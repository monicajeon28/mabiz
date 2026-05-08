// app/partner/[partnerId]/team-statements/page.tsx
// 대리점장 팀원 정산 명세서 페이지

import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import TeamStatementsClient from './TeamStatementsClient';

interface PageProps {
  params: {
    partnerId: string;
  };
}

export default async function TeamStatementsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { partnerId } = resolvedParams;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  // 사용자 정보 조회
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      mallUserId: true,
      mallNickname: true,
    },
  });

  // 사용자 존재 여부 먼저 확인
  if (!user) {
    redirect('/login');
  }

  // mallUserId 소유권 확인 (타입 안전한 비교)
  if (!user.mallUserId || user.mallUserId !== partnerId) {
    redirect('/login');
  }

  // 파트너 프로필 조회
  const profile = await prisma.affiliateProfile.findFirst({
    where: { userId: sessionUser.id },
    select: {
      id: true,
      type: true,
      affiliateCode: true,
      displayName: true,
    },
  });

  if (!profile) {
    redirect(`/partner/${partnerId}/dashboard`);
  }

  // 대리점장만 접근 가능 (BRANCH_MANAGER 권한 체크)
  if (profile.type !== 'BRANCH_MANAGER') {
    redirect(`/partner/${partnerId}/dashboard`);
  }

  return (
    <TeamStatementsClient
      currentUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        mallUserId: user.mallUserId || partnerId,
        mallNickname: user.mallNickname,
      }}
      profile={profile}
    />
  );
}
