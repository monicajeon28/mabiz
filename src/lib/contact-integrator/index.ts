/**
 * Customer Integrator - Main Orchestrator
 * 고객 360도 통합 뷰 조회 및 캐싱 관리
 */

import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import DataLoader from 'dataloader';
import { Contact360Response, Contact360Metrics, Contact360Group } from './types';
import { maskPII, MaskOptions } from './pii-mask';
import { calculateRiskScore } from './risk-calculator';

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
  const cached = await redis.get(cacheKey);

  if (cached) {
    const data = JSON.parse(cached);

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
  await redis.setex(cacheKey, ttl, JSON.stringify(contact360));

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

  // DataLoader 생성
  const loaders = createDataLoaders();

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
  const riskProfile = await calculateRiskScore(contact);

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
      autoSegment: contact.autoSegment,
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
    contactLoader: new DataLoader(async (contactIds: string[]) => {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
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
    goldMemberLoader: new DataLoader(async (userIds: (number | null)[]) => {
      const filtered = userIds.filter((uid): uid is number => uid !== null);
      if (filtered.length === 0) return userIds.map(() => null);

      const members = await prisma.goldMember.findMany({
        where: { userId: { in: filtered } },
        include: { consultations: true }
      });

      return userIds.map(uid =>
        uid ? members.find(m => m.userId === uid) || null : null
      );
    }),

    // Partner 로더
    partnerLoader: new DataLoader(async (partnerIds: string[]) => {
      const partners = await prisma.partner.findMany({
        where: { id: { in: partnerIds } },
        include: {
          metrics: { orderBy: { createdAt: 'desc' }, take: 2 },
          riskFlags: true
        }
      });

      return partnerIds.map(id =>
        partners.find(p => p.id === id) ||
        new Error(`Partner ${id} not found`)
      );
    }),

    // Groups 로더
    groupsLoader: new DataLoader(async (contactIds: string[]) => {
      const members = await prisma.contactGroupMember.findMany({
        where: { contactId: { in: contactIds } },
        include: { group: true }
      });

      const grouped = new Map<string, Contact360Group[]>();
      members.forEach(member => {
        const list = grouped.get(member.contactId) || [];
        list.push({
          id: member.group.id,
          name: member.group.name,
          color: member.group.color || '#6B7280',
          ownerId: member.group.ownerId,
          memberCount: 0, // TODO: 조회
          addedAt: member.addedAt
        });
        grouped.set(member.contactId, list);
      });

      return contactIds.map(id => grouped.get(id) || []);
    }),

    // Orders 로더
    ordersLoader: new DataLoader(async (contactIds: string[]) => {
      const reservations = await prisma.gmReservation.findMany({
        where: {
          contacts: { some: { id: { in: contactIds } } }
        },
        include: { cruiseProduct: true },
        take: 100
      });

      // TODO: Contact와 Reservation 관계 매핑
      return contactIds.map(() => []);
    }),

    // Communications 로더
    communicationsLoader: new DataLoader(async (contactIds: string[]) => {
      // TODO: SMS, Email, Call 로그 조회
      return contactIds.map(() => ({
        smsLogs: [],
        emailLogs: [],
        callLogs: [],
        totalInteractions: 0,
        lastInteractionAt: null
      }));
    }),

    // Psychology 로더
    psychologyLoader: new DataLoader(async (contactIds: string[]) => {
      const classifications = await prisma.contactLensClassification.findMany({
        where: { contactId: { in: contactIds }, status: 'ACTIVE' },
        include: { sequences: true }
      });

      const grouped = new Map<string, typeof classifications>();
      classifications.forEach(c => {
        const list = grouped.get(c.contactId) || [];
        list.push(c);
        grouped.set(c.contactId, list);
      });

      return contactIds.map(id => {
        const classifs = grouped.get(id) || [];
        return {
          lensClassifications: classifs.map(c => ({
            lensType: c.lensType,
            lensLabel: c.lensLabel,
            confidenceScore: c.confidenceScore,
            status: c.status,
            identifiedAt: c.identifiedAt,
            readinessScore: c.readinessScore,
            priorityLevel: c.priorityLevel
          })),
          sequenceStatus: {} // TODO: 시퀀스 상태 매핑
        };
      });
    }),

    // Affiliate 로더
    affiliateLoader: new DataLoader(async (contactIds: string[]) => {
      // TODO: Affiliate 추적 정보 조회
      return contactIds.map(() => null);
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
function formatPartner(p: any) {
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
    metrics: {
      thisMonth: {},
      lastMonth: {}
    },
    riskFlags: p.riskFlags ? {
      suspensionRisk: 'GREEN' as const,
      automationGap: 100 - p.automationRate,
      churnRisk: false
    } : null
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
  await redis.del(cacheKey);
}

/**
 * 배치 캐시 무효화
 */
export async function invalidateContact360CacheBatch(
  contactIds: string[],
  orgId: string
) {
  const keys = contactIds.map(id => `contact:360:${orgId}:${id}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
