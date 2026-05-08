export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import PurchasedCustomersClient from './PurchasedCustomersClient';

export default async function PurchasedCustomersPage({ params }: { params: Promise<{ partnerId: string }> }) {
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
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/purchased-customers`);
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

    // 대리점장의 실제 어필리에이트 링크 생성
    // /api/partner/links의 로직과 동일하게 생성
    const shareLinks = {
      // 파트너몰 링크 (자동 추적됨 - AffiliateTracker가 쿠키 설정)
      mall: `/${mallUserId}/shop`,
      // 추적 링크는 mall과 동일 (중복 제거)
      tracked: `/${mallUserId}/shop`,
      // 랜딩 페이지 링크
      landing:
        profile.affiliateCode && profile.landingSlug
          ? `/store/${profile.affiliateCode}/${profile.landingSlug}`
          : null,
    };

    // 대리점장의 manager 정보 조회 (있는 경우)
    let manager = null;
    if (profile.type === 'SALES_AGENT') {
      const relation = await prisma.affiliateRelation.findFirst({
        where: {
          agentId: profile.id,
          status: 'ACTIVE',
        },
        include: {
          AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              nickname: true,
              affiliateCode: true,
              branchLabel: true,
              status: true,
              contactPhone: true,
              contactEmail: true,
              User: {
                select: {
                  mallUserId: true,
                },
              },
            },
          },
        },
      });

      if (relation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile) {
        const managerProfile = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
        manager = {
          label: managerProfile.displayName || managerProfile.nickname || null,
          affiliateCode: managerProfile.affiliateCode,
          branchLabel: managerProfile.branchLabel,
          mallUserId: managerProfile.User?.mallUserId || null,
        };
      }
    }

    // 팀 판매원 목록 조회 (대리점장인 경우)
    let teamAgents: Array<{
      id: number;
      displayName: string | null;
      affiliateCode: string | null;
      mallUserId: string | null;
    }> = [];
    
    if (profile.type === 'BRANCH_MANAGER') {
      const relations = await prisma.affiliateRelation.findMany({
        where: {
          managerId: profile.id,
          status: 'ACTIVE',
        },
        include: {
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
      });

      teamAgents = relations
        .map((r) => r.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile)
        .filter((agent): agent is NonNullable<typeof agent> => agent !== null)
        .map((agent) => ({
          id: agent.id,
          displayName: agent.displayName,
          affiliateCode: agent.affiliateCode,
          mallUserId: agent.User?.mallUserId || null,
        }));
    }

    return (
      <PurchasedCustomersClient
        partner={{
          profileId: profile.id,
          type: profile.type,
          displayName: profile.displayName,
          branchLabel: profile.branchLabel,
          mallUserId,
          shareLinks,
          manager,
          teamAgents,
        }}
      />
    );
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}

