import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export default async function SnsProfilePage({ params }: { params: Promise<{ partnerId: string }> }) {
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
        // 본인의 프로필로 리다이렉트
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/sns-profile`);
      }
      
      const { default: SnsProfileClient } = await import('./SnsProfileClient');
      const targetUser = await prisma.user.findFirst({
        where: { mallUserId: partnerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          mallUserId: true,
          mallNickname: true,
        },
      });

      if (!targetUser) {
        redirect('/partner');
      }

      const targetProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: targetUser.id },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              mallUserId: true,
              mallNickname: true,
            },
          },
        },
      });

      if (!targetProfile) {
        redirect('/partner');
      }

      // 프론트엔드 형식에 맞게 변환
      const formattedProfile = {
        ...targetProfile,
        user: targetProfile.User,
      };

      return <SnsProfileClient user={targetUser} profile={formattedProfile} />;
    } else {
      // 관리자는 해당 mallUserId의 사용자가 존재하는지만 확인
      const targetUser = await prisma.user.findFirst({
        where: { mallUserId: partnerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          mallUserId: true,
          mallNickname: true,
        },
      });

      if (!targetUser) {
        redirect('/admin/affiliate/mall');
      }

      const targetProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: targetUser.id },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              mallUserId: true,
              mallNickname: true,
            },
          },
        },
      });

      if (!targetProfile) {
        redirect('/admin/affiliate/mall');
      }

      // 프론트엔드 형식에 맞게 변환
      const formattedProfile = {
        ...targetProfile,
        user: targetProfile.User,
      };

      const { default: SnsProfileClient } = await import('./SnsProfileClient');
      return <SnsProfileClient user={targetUser} profile={formattedProfile} />;
    }
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}


