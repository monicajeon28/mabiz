export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { leadStatusOptions } from '@/app/api/partner/constants';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import PartnerCustomersClient from './PartnerCustomersClient';

export default async function PartnerCustomersPage({ params }: { params: Promise<{ partnerId: string }> }) {
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
      const context = await requirePartnerContext({ includeManagedAgents: true });
      profile = context.profile;

      // If not viewing own customers page, redirect to own customers page
      if (profile.User?.mallUserId && profile.User.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User.mallUserId}/customers`);
      } else if (!profile.User?.mallUserId) {
        // Should not happen if requirePartnerContext works, but for safety
        throw new PartnerApiError('파트너 정보가 올바르지 않습니다 (ID 누락).', 403);
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
          AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile: {
            where: { status: 'ACTIVE' },
            select: {
              AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  affiliateCode: true,
                  User: {
                    select: {
                      mallUserId: true,
                    },
                  },
                },
              },
            },
          },
          AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
            where: { status: 'ACTIVE' },
            select: {
              AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                select: {
                  displayName: true,
                  affiliateCode: true,
                  branchLabel: true,
                  User: {
                    select: {
                      mallUserId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!targetProfile) {
        redirect('/partner');
      }

      profile = targetProfile;
    }

    const mallUserId = profile.User?.mallUserId;
    if (!mallUserId) {
      redirect('/partner');
    }

    const shareLinks = {
      mall: `/${mallUserId}/shop`,
      tracked: `/${mallUserId}/shop`,
      landing:
        profile.affiliateCode && profile.landingSlug
          ? `/store/${profile.affiliateCode}/${profile.landingSlug}`
          : null,
    };

    const teamAgents =
      profile.AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile?.map((relation) => {
        const agent = relation.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile;
        if (!agent) return null;
        return {
          id: agent.id,
          displayName: agent.displayName,
          affiliateCode: agent.affiliateCode,
          mallUserId: agent.User?.mallUserId ?? null,
        };
      }).filter(Boolean) ?? [];

    return (
      <PartnerCustomersClient
        partner={{
          profileId: profile.id,
          type: profile.type,
          displayName: profile.displayName,
          branchLabel: profile.branchLabel,
          mallUserId,
          shareLinks,
          manager:
            profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile?.[0]?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.displayName
              ? {
                label: profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.displayName,
                affiliateCode: profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.affiliateCode,
                branchLabel: profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.branchLabel,
                mallUserId: profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.User?.mallUserId ?? null,
              }
              : null,
          teamAgents: teamAgents as Array<{
            id: number;
            displayName: string | null;
            affiliateCode: string | null;
            mallUserId: string | null;
          }>,
        }}
        leadStatusOptions={leadStatusOptions}
      />
    );
  } catch (error) {
    console.error('[PartnerCustomersPage] Error:', error);
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    // For other errors, throw them to be handled by Next.js error boundary
    // This prevents confusing redirects to login page on 403, 404, or 500 errors
    throw error;
  }
}
