export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import PartnerTeamClient from './PartnerTeamClient';

export default async function PartnerTeamPage({ params }: { params: Promise<{ partnerId: string }> }) {
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
    if (!isAdmin) {
      const context = await requirePartnerContext();
      profile = context.profile;

      // Check if user is BRANCH_MANAGER
      if (profile.type !== 'BRANCH_MANAGER') {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/dashboard`);
      }

      // If not viewing own team page, redirect to own team page
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/team`);
      }
    } else {
      // Admin: fetch the target user's profile
      const targetUser = await prisma.user.findFirst({
        where: { mallUserId: partnerId },
        select: { id: true },
      });

      if (!targetUser) {
        redirect('/partner');
      }

      const targetProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: targetUser.id },
        select: {
          id: true,
          type: true,
          status: true,
        },
      });

      if (!targetProfile) {
        redirect('/partner');
      }

      // Admin can only view BRANCH_MANAGER's team page
      if (targetProfile.type !== 'BRANCH_MANAGER') {
        redirect(`/partner/${partnerId}/dashboard`);
      }

      profile = targetProfile;
    }

    return <PartnerTeamClient />;
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}
