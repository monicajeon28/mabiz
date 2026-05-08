export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import PartnerDashboard from './PartnerDashboard';

export default async function PartnerDashboardPage({ params }: { params: Promise<{ partnerId: string }> }) {
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

      // If not viewing own dashboard, redirect to own dashboard
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/dashboard`);
      }
    }

    // Fetch the target user by mallUserId
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

    if (!targetUser?.mallUserId) {
      redirect('/partner');
    }

    // Fetch the target user's profile
    let targetProfile = await prisma.affiliateProfile.findFirst({
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
        AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
          where: { status: 'ACTIVE' },
          select: {
            managerId: true,
            AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
              select: {
                id: true,
                affiliateCode: true,
                type: true,
                displayName: true,
                branchLabel: true,
                contactPhone: true,
                contactEmail: true,
              },
            },
          },
        },
      },
    });

    // AffiliateProfile이 없으면 생성 (기존 사용자 대응)
    if (!targetProfile && targetUser.id === sessionUser.id) {
      const isBoss = targetUser.phone?.toLowerCase().startsWith('boss') || targetUser.mallUserId?.toLowerCase().startsWith('boss');
      const { randomBytes } = await import('crypto');
      const affiliateCode = `AFF-${(targetUser.mallUserId || partnerId).toUpperCase()}-${randomBytes(2)
        .toString('hex')
        .toUpperCase()}`;
      const now = new Date();
      
      try {
        targetProfile = await prisma.affiliateProfile.create({
          data: {
            userId: targetUser.id,
            affiliateCode,
            type: isBoss ? 'BRANCH_MANAGER' : 'SALES_AGENT',
            status: 'ACTIVE',
            displayName: targetUser.mallNickname || targetUser.mallUserId || '파트너',
            nickname: targetUser.mallNickname || targetUser.mallUserId || '파트너',
            branchLabel: null,
            landingSlug: targetUser.mallUserId || partnerId || undefined,
            landingAnnouncement: '파트너 전용 샘플 계정입니다.',
            welcomeMessage: '반갑습니다! 파트너몰 테스트 계정입니다.',
            updatedAt: now,
          },
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
            AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
              where: { status: 'ACTIVE' },
              select: {
                managerId: true,
                AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                  select: {
                    id: true,
                    affiliateCode: true,
                    type: true,
                    displayName: true,
                    branchLabel: true,
                    contactPhone: true,
                    contactEmail: true,
                  },
                },
              },
            },
          },
        });
      } catch (createError: any) {
        logger.error('[Partner Dashboard] AffiliateProfile 생성 실패', { error: createError });
        // 중복 키 에러인 경우 다시 조회
        if (createError?.code === 'P2002') {
          targetProfile = await prisma.affiliateProfile.findFirst({
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
              AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
                where: { status: 'ACTIVE' },
                select: {
                  managerId: true,
                  AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                    select: {
                      id: true,
                      affiliateCode: true,
                      type: true,
                      displayName: true,
                      branchLabel: true,
                      contactPhone: true,
                      contactEmail: true,
                    },
                  },
                },
              },
            },
          });
        }
      }
    }

    if (!targetProfile) {
      redirect('/partner');
    }

    // 체험 사용자인지 확인 (mallUserId가 trial_로 시작하는지 확인)
    const isTrialUser = targetUser.mallUserId?.startsWith('trial_');
    let trialInfo: { trialEndDate: string | null; daysRemaining: number | null } | null = null;

    if (isTrialUser) {
      // 체험 계약서 정보 가져오기
      const trialContract = await prisma.affiliateContract.findFirst({
        where: {
          userId: targetUser.id,
          metadata: {
            path: ['isTrial'],
            equals: true,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          metadata: true,
        },
      });

      if (trialContract && trialContract.metadata) {
        const metadata = trialContract.metadata as any;
        const trialEndDate = metadata.trialEndDate ? new Date(metadata.trialEndDate) : null;

        if (trialEndDate) {
          const now = new Date();
          const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          trialInfo = {
            trialEndDate: trialEndDate.toISOString(),
            daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
          };
        }
      }
    }

    return <PartnerDashboard user={targetUser} profile={targetProfile} trialInfo={trialInfo} />;
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}
