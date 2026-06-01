/**
 * Customer Integrator - Main Orchestrator
 * 고객 360도 통합 뷰 조회 및 캐싱 관리
 */

import prisma from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import DataLoader from 'dataloader';
import { Contact360Response, Contact360Metrics, Contact360Group, Contact360Partner } from './types';
import { maskPII, MaskOptions } from './pii-mask';
import { calculateRiskScore } from './risk-calculator';

/**
 * DataLoader 싱글톤 (메모리 누수 방지)
 */
let dataLoadersInstance: ReturnType<typeof createDataLoaders> | null = null;

function getDataLoaders() {
  if (!dataLoadersInstance) {
    dataLoadersInstance = createDataLoaders();
  }
  return dataLoadersInstance;
}

/**
 * Contact 360도 뷰 조회 (캐시 포함)
 */
export async function getContact360(
  contactId: string,
  orgId: string,
  maskOptions?: MaskOptions
): Promise<Contact360Response> {
  const startTime = Date.now();

  // 1. 캐시 조회
  const cacheKey = `contact:360:${orgId}:${contactId}`;
  const redisClient = getRedis();
  const cached = redisClient ? await redisClient.get(cacheKey) : null;

  if (cached) {
    const data = JSON.parse(cached as string);

    // PII 마스킹 적용 (필요시)
    if (maskOptions) {
      return maskPII(data, maskOptions);
    }

    return data;
  }

  // 2. DB에서 신규 조회
  const contact360 = await fetchContact360FromDb(contactId, orgId);

  // 3. 캐시 저장 (TTL: 30분)
  const ttl = 30 * 60;
  if (redisClient) await redisClient.setex(cacheKey, ttl, JSON.stringify(contact360));

  // 4. PII 마스킹 적용 (필요시)
  if (maskOptions) {
    return maskPII(contact360, maskOptions);
  }

  return contact360;
}

/**
 * Contact 360도 뷰 조회 (DB 직접)
 */
async function fetchContact360FromDb(
  contactId: string,
  orgId: string
): Promise<Contact360Response> {
  const startTime = Date.now();

  // DataLoader 싱글톤 사용 (메모리 누수 방지)
  const loaders = getDataLoaders();

  // 1. Contact 조회
  const contact = await loaders.contactLoader.load(contactId);

  if (!contact || contact.organizationId !== orgId) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  // 2. GoldMember 조회 (선택)
  const goldMember = contact.userId
    ? await loaders.goldMemberLoader.load(contact.userId)
    : null;

  // 3. Partner 조회 (선택)
  const partner = contact.partnerId
    ? await loaders.partnerLoader.load(contact.partnerId)
    : null;

  // 4. 병렬 조회 (Groups, Orders, Communications)
  const [groups, orders, communications] = await Promise.all([
    loaders.groupsLoader.load(contactId),
    loaders.ordersLoader.load(contactId),
    loaders.communicationsLoader.load(contactId)
  ]);

  // 5. Psychology Profile 조회
  const psychologyProfile = await loaders.psychologyLoader.load(contactId);

  // 6. Affiliate Tracking 조회 (선택)
  const affiliateTracking = contact.affiliateLinkId
    ? await loaders.affiliateLoader.load(contactId)
    : null;

  // 7. Risk Score 계산
  const contactForRisk = {
    ...contact,
    reactivationSegment: contact.reactivationSegment ?? undefined,
    lastCruiseDate: contact.lastCruiseDate ?? undefined,
    lastCompetitorMentionAt: contact.lastCompetitorMentionAt ?? undefined,
    lastContactedAt: contact.lastContactedAt ?? undefined,
  };
  const riskProfile = await calculateRiskScore(contactForRisk as any);

  // 8. 응답 구성
  const response: Contact360Response = {
    contact: {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      email: contact.email,
      organizationId: contact.organizationId,
      type: contact.type as 'LEAD' | 'CUSTOMER' | 'VIP',
      segment: contact.segment,
      autoSegment: contact.autoSegment ?? '',
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      lastContactedAt: contact.lastContactedAt,
      tags: contact.tags
    },
    goldMember: goldMember ? formatGoldMember(goldMember) : null,
    partner: partner ? formatPartner(partner) : null,
    groups,
    orders,
    communications,
    psychologyProfile,
    riskProfile,
    affiliateTracking,
    metadata: {
      dataQuality: {
        completeness: 0.95,
        lastValidatedAt: new Date(),
        issues: []
      },
      cacheInfo: {
        cachedAt: new Date(),
        ttl: 1800,
        source: 'database'
      }
    }
  };

  return response;
}

/**
 * DataLoader 생성
 */
function createDataLoaders() {
  return {
    // Contact 로더
    contactLoader: new DataLoader(async (contactIds: readonly string[]) => {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: [...contactIds] } },
        include: {
          organization: true
        }
      });

      return contactIds.map(id =>
        contacts.find(c => c.id === id) ||
        new Error(`Contact ${id} not found`)
      );
    }),

    // GoldMember 로더
    goldMemberLoader: new DataLoader(async (userIds: readonly (number | null)[]) => {
      const filtered = userIds.filter((uid): uid is number => uid !== null);
      if (filtered.length === 0) return userIds.map(() => null);

      const members = await prisma.goldMember.findMany({
        where: { userId: { in: filtered } },
        include: { consultations: true }
      });

      // Map을 사용하여 null 참조 방지
      const memberMap = new Map(members.map(m => [m.userId, m]));
      return userIds.map(uid => uid ? memberMap.get(uid) ?? null : null);
    }),

    // Partner 로더
    partnerLoader: new DataLoader(async (partnerIds: readonly string[]) => {
      const partners = await prisma.partner.findMany({
        where: { id: { in: [...partnerIds] } },
        include: {
          metrics: { orderBy: { createdAt: 'desc' }, take: 2 },
          riskFlags: true
        }
      });

      return [...partnerIds].map(id =>
        partners.find(p => p.id === id) ||
        new Error(`Partner ${id} not found`)
      );
    }),

    // Groups 로더
    groupsLoader: new DataLoader(async (contactIds: readonly string[]) => {
      const members = await prisma.contactGroupMember.findMany({
        where: { contactId: { in: [...contactIds] } },
        select: { id: true, contactId: true, groupId: true, addedAt: true }
      });

      // Get unique groupIds and fetch groups in bulk
      const groupIds = [...new Set(members.map(m => m.groupId))];
      const groups = await prisma.contactGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true, color: true, ownerId: true }
      });
      const groupMap = new Map(groups.map(g => [g.id, g]));

      const grouped = new Map<string, Contact360Group[]>();
      members.forEach(member => {
        const group = groupMap.get(member.groupId);
        if (group) {
          const list = grouped.get(member.contactId) || [];
          list.push({
            id: group.id,
            name: group.name,
            color: group.color || '#6B7280',
            ownerId: group.ownerId,
            memberCount: 0, // TODO: 조회
            addedAt: member.addedAt
          });
          grouped.set(member.contactId, list);
        }
      });

      return [...contactIds].map(id => grouped.get(id) || []);
    }),

    // Orders 로더
    ordersLoader: new DataLoader(async (contactIds: readonly string[]) => {
      const reservations = await prisma.gmReservation.findMany({
        where: {
          contacts: { some: { id: { in: [...contactIds] } } }
        },
        include: { trip: true },
        take: 100
      });

      // TODO: Contact와 Reservation 관계 매핑
      return [...contactIds].map(() => []);
    }),

    // Communications 로더
    communicationsLoader: new DataLoader(async (contactIds: readonly string[]) => {
      // TODO: SMS, Email, Call 로그 조회
      return [...contactIds].map(() => ({
        smsLogs: [],
        emailLogs: [],
        callLogs: [],
        totalInteractions: 0,
        lastInteractionAt: null
      }));
    }),

    // Psychology 로더
    psychologyLoader: new DataLoader(async (contactIds: readonly string[]) => {
      const classifications = await prisma.contactLensClassification.findMany({
        where: { contactId: { in: [...contactIds] }, status: 'ACTIVE' },
        include: { sequences: true }
      });

      const grouped = new Map<string, typeof classifications>();
      classifications.forEach(c => {
        const list = grouped.get(c.contactId) || [];
        list.push(c);
        grouped.set(c.contactId, list);
      });

      return [...contactIds].map(id => {
        const classifs = grouped.get(id) || [];
        return {
          lensClassifications: classifs.map(c => ({
            lensType: c.lensType,
            lensLabel: c.lensLabel ?? '',
            confidenceScore: c.confidenceScore,
            status: (c.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE' | 'CONVERTED',
            identifiedAt: c.identifiedAt,
            readinessScore: c.readinessScore,
            priorityLevel: (c.priorityLevel ?? 'P2') as 'P0' | 'P1' | 'P2'
          })),
          sequenceStatus: {} as Record<string, any> // TODO: 시퀀스 상태 매핑
        };
      });
    }),

    // Affiliate 로더
    affiliateLoader: new DataLoader(async (contactIds: readonly string[]) => {
      // TODO: Affiliate 추적 정보 조회
      return [...contactIds].map(() => null);
    })
  };
}

/**
 * GoldMember 포맷팅
 */
function formatGoldMember(gm: any) {
  return {
    id: gm.id,
    memberCode: gm.memberCode,
    courseType: gm.courseType,
    status: gm.status,
    joinDate: gm.joinDate,
    totalPayments: gm.totalPayments,
    paidCount: gm.paidCount,
    maxPaymentCount: gm.maxPaymentCount,
    tier: gm.tier,
    consultations: gm.consultations.map((c: any) => ({
      id: c.id,
      content: c.content,
      authorId: c.authorId,
      createdAt: c.createdAt
    }))
  };
}

/**
 * Partner 포맷팅
 */
function formatPartner(p: any): Contact360Partner {
  const metrics = p.metrics && Array.isArray(p.metrics) && p.metrics.length > 0
    ? {
        thisMonth: {
          customerCount: p.metrics[0]?.customerCount ?? 0,
          leadCount: p.metrics[0]?.leadCount ?? 0,
          revenue: p.metrics[0]?.revenue ?? 0,
        },
        lastMonth: {
          customerCount: p.metrics[1]?.customerCount ?? 0,
          leadCount: p.metrics[1]?.leadCount ?? 0,
          revenue: p.metrics[1]?.revenue ?? 0,
        },
      }
    : {
        thisMonth: { customerCount: 0, leadCount: 0, revenue: 0 },
        lastMonth: { customerCount: 0, leadCount: 0, revenue: 0 },
      };

  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    status: p.status,
    commissionRate: p.commissionRate,
    totalRevenue: p.totalRevenue,
    onboardingStatus: p.onboardingStatus,
    incomeLevel: p.incomeLevel,
    monthlyIncomeGoal: p.monthlyIncomeGoal,
    automationRate: p.automationRate,
    metrics,
    riskFlags: p.riskFlags ? {
      suspensionRisk: 'GREEN' as const,
      automationGap: 100 - (p.automationRate ?? 0),
      churnRisk: false
    } : {
      suspensionRisk: 'GREEN' as const,
      automationGap: 100,
      churnRisk: false,
    }
  };
}

/**
 * 캐시 무효화
 */
export async function invalidateContact360Cache(
  contactId: string,
  orgId: string
) {
  const cacheKey = `contact:360:${orgId}:${contactId}`;
  const redisClient = getRedis();
  if (redisClient) await redisClient.del(cacheKey);
}

/**
 * 배치 캐시 무효화
 */
export async function invalidateContact360CacheBatch(
  contactIds: string[],
  orgId: string
) {
  const keys = contactIds.map(id => `contact:360:${orgId}:${id}`);
  const redisClient = getRedis();
  if (keys.length > 0 && redisClient) {
    await redisClient.del(...keys);
  }
}
