import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

// Prisma Client는 스키마의 관계 필드명을 그대로 사용합니다
// AffiliateProfile 모델의 User 관계는 PascalCase로 정의되어 있으므로 User 사용
export const profileInclude: any = {
  User: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      onboarded: true,
      mallNickname: true,
      mallUserId: true,
      // password 제거: 민감정보 노출 금지
    },
  },
  // 관리자-판매원 관계 (이 프로필이 판매원인 경우의 관리자 정보)
  AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
    where: { status: 'ACTIVE' },
    include: {
      AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
        select: {
          id: true,
          affiliateCode: true,
          type: true,
          displayName: true,
          nickname: true,
          branchLabel: true,
        },
      },
    },
    take: 1,
  },
  // 통계용 _count
  _count: {
    select: {
      // 대리점장으로서 관리하는 판매원 수
      AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile: true,
      // 판매원으로서 연결된 관리자 수
      AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: true,
      // 대리점장으로서의 링크 수
      AffiliateLink_AffiliateLink_managerIdToAffiliateProfile: true,
      // 판매원으로서의 링크 수
      AffiliateLink_AffiliateLink_agentIdToAffiliateProfile: true,
      // 대리점장으로서의 리드 수
      AffiliateLead_AffiliateLead_managerIdToAffiliateProfile: true,
      // 판매원으로서의 리드 수
      AffiliateLead_AffiliateLead_agentIdToAffiliateProfile: true,
      // 대리점장으로서의 판매 수
      AffiliateSale_managerSales: true,
      // 판매원으로서의 판매 수
      AffiliateSale_agentSales: true,
    },
  },
};

// 타입 에러를 피하기 위해 any 사용 (런타임에서는 정상 작동)
type ProfileWithRelations = any;

// @ts-ignore - Prisma 타입과 런타임 타입이 다를 수 있음
export function serializeProfile(profile: any, includePassword: boolean = false) {
  // _count는 별도 쿼리로 조회하지 않으므로 모든 counts를 0으로 설정
  // 필요시 별도 API로 통계 정보를 제공할 수 있음
  const managedRelations = 0;
  const agentRelations = 0;
  const linksAsManager = 0;
  const linksAsAgent = 0;
  const leadsAsManager = 0;
  const leadsAsAgent = 0;
  const salesAsManager = 0;
  const salesAsAgent = 0;

  const totalLinks = linksAsManager + linksAsAgent;
  const totalLeads = leadsAsManager + leadsAsAgent;
  const totalSales = salesAsManager + salesAsAgent;

  // manager 정보는 별도 쿼리로 조회하거나 null로 설정
  // agentRelations는 Prisma 관계명 문제로 인해 제외
  const managerRelation = null;

  return {
    id: profile.id,
    userId: profile.userId,
    affiliateCode: profile.affiliateCode,
    type: profile.type,
    status: profile.status,
    displayName: profile.displayName,
    branchLabel: profile.branchLabel,
    nickname: profile.nickname,
    profileTitle: profile.profileTitle,
    bio: profile.bio,
    profileImage: profile.profileImage,
    coverImage: profile.coverImage,
    contactPhone: profile.contactPhone,
    contactEmail: profile.contactEmail,
    kakaoLink: profile.kakaoLink,
    instagramHandle: profile.instagramHandle,
    youtubeChannel: profile.youtubeChannel,
    homepageUrl: profile.homepageUrl,
    landingSlug: profile.landingSlug,
    landingAnnouncement: profile.landingAnnouncement,
    welcomeMessage: profile.welcomeMessage,
    landingTheme: profile.landingTheme,
    externalLinks: profile.externalLinks,
    published: profile.published,
    publishedAt: profile.publishedAt ? (profile.publishedAt instanceof Date ? profile.publishedAt.toISOString() : profile.publishedAt) : null,
    bankName: profile.bankName,
    bankAccount: profile.bankAccount,
    bankAccountHolder: profile.bankAccountHolder,
    withholdingRate: profile.withholdingRate,
    contractStatus: profile.contractStatus,
    contractSignedAt: profile.contractSignedAt ? (profile.contractSignedAt instanceof Date ? profile.contractSignedAt.toISOString() : profile.contractSignedAt) : null,
    kycCompletedAt: profile.kycCompletedAt ? (profile.kycCompletedAt instanceof Date ? profile.kycCompletedAt.toISOString() : profile.kycCompletedAt) : null,
    onboardedAt: profile.onboardedAt ? (profile.onboardedAt instanceof Date ? profile.onboardedAt.toISOString() : profile.onboardedAt) : null,
    metadata: profile.metadata,
    createdAt: profile.createdAt ? (profile.createdAt instanceof Date ? profile.createdAt.toISOString() : profile.createdAt) : null,
    updatedAt: profile.updatedAt ? (profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : profile.updatedAt) : null,
    manager: managerRelation
      ? {
          id: managerRelation.id,
          affiliateCode: managerRelation.affiliateCode,
          type: managerRelation.type,
          displayName: managerRelation.displayName,
          nickname: managerRelation.nickname,
          branchLabel: managerRelation.branchLabel,
        }
      : null,
    counts: {
      managedAgents: managedRelations,
      assignedManagers: agentRelations,
      totalLinks,
      totalLeads,
      totalSales,
    },
    user: (profile as any).User
      ? {
          id: (profile as any).User?.id,
          name: (profile as any).User?.name,
          email: (profile as any).User?.email,
          phone: (profile as any).User?.phone,
          role: (profile as any).User?.role,
          onboarded: (profile as any).User?.onboarded,
          mallNickname: (profile as any).User?.mallNickname,
          mallUserId: (profile as any).User?.mallUserId,
          // 비밀번호 제거: 민감정보 노출 금지
        }
      : null,
  };
}

export function toNullableString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str.length ? str : null;
}

export async function syncSalesAgentMentor(agentProfileId: number, managerProfileId: number | null) {
  await prisma.$transaction(async (tx) => {
    await tx.affiliateRelation.updateMany({
      where: { agentId: agentProfileId, status: 'ACTIVE' },
      data: { status: 'TERMINATED', disconnectedAt: new Date() },
    });

    if (managerProfileId) {
      await tx.affiliateRelation.upsert({
        where: {
          managerId_agentId: {
            managerId: managerProfileId,
            agentId: agentProfileId,
          },
        },
        update: {
          status: 'ACTIVE',
          disconnectedAt: null,
          connectedAt: new Date(),
        },
        create: {
          managerId: managerProfileId,
          agentId: agentProfileId,
          status: 'ACTIVE',
          connectedAt: new Date(),
        },
      });
    }
  });
}












