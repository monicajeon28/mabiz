// app/partner/[partnerId]/statements/page.tsx
// 파트너 지급명세서 확인 페이지

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import PartnerStatementsClient from './PartnerStatementsClient';

export default async function PartnerStatementsPage({ params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect('/partner');
    }

    // Check if admin
    const isAdmin = sessionUser.role === 'admin';

    // For non-admin users, require partner context
    let profile;
    let targetUser;
    if (!isAdmin) {
      const context = await requirePartnerContext();
      profile = context.profile;

      // If not viewing own statements page, redirect to own statements page
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/statements`);
      }

      targetUser = profile.User;
    } else {
      // Admin: fetch the target user's data
      targetUser = await prisma.user.findFirst({
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

      if (!targetUser?.mallUserId) {
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

      profile = targetProfile;
    }

    return <PartnerStatementsClient currentUser={targetUser} profile={profile} />;
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}

