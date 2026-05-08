export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  ensureValidLeadStatus,
  normalizePhoneInput,
  partnerLeadInclude,
  phoneSearchVariants,
  requirePartnerContext,
  resolveCounterpart,
  resolveOwnership,
  serializeLead,
} from '@/app/api/partner/_utils';
import { toNullableString } from '@/app/api/admin/affiliate/profiles/shared';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const requestedLimit = parseInt(searchParams.get('limit') ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildOrderBy(sort: string | null) {
  switch (sort) {
    case 'nextAction':
      return [{ nextActionAt: 'asc' }, { createdAt: 'desc' }] as Prisma.AffiliateLeadOrderByWithRelationInput[];
    case 'lastContacted':
      return [{ lastContactedAt: 'desc' }, { updatedAt: 'desc' }];
    case 'recent':
    default:
      return [{ updatedAt: 'desc' }, { createdAt: 'desc' }];
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log('[GET /api/partner/customers] Starting request...');
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });
    console.log('[GET /api/partner/customers] Profile:', { id: profile.id, type: profile.type });
    const { searchParams } = new URL(req.url);
    console.log('[GET /api/partner/customers] Search params:', Object.fromEntries(searchParams.entries()));

    const { page, limit, skip } = parsePagination(searchParams);
    const statusFilter = ensureValidLeadStatus(searchParams.get('status'));
    const query = searchParams.get('q')?.trim() || '';
    const sort = searchParams.get('sort');
    const source = searchParams.get('source'); // 전화상담고객 필터 (mall)
    const agentIdParam = searchParams.get('agentId'); // 판매원 필터

    // 대리점장인 경우: 랜딩페이지로 유입된 고객도 포함
    // SharedLandingPage를 통해 공유된 랜딩페이지의 등록 고객 조회
    let landingPageUserIds: number[] = [];
    if (profile.type === 'BRANCH_MANAGER') {
      // 이 점장에게 공유된 랜딩페이지 조회
      const sharedLandingPages = await prisma.sharedLandingPage.findMany({
        where: {
          managerProfileId: profile.id,
        },
        select: {
          landingPageId: true,
        },
      });

      if (sharedLandingPages.length > 0) {
        const landingPageIds = sharedLandingPages.map(slp => slp.landingPageId);

        // 해당 랜딩페이지로 등록된 고객의 userId 조회
        const landingPageRegistrations = await prisma.landingPageRegistration.findMany({
          where: {
            landingPageId: { in: landingPageIds },
            userId: { not: null },
            deletedAt: null,
          },
          select: {
            userId: true,
          },
        });

        landingPageUserIds = landingPageRegistrations
          .map(reg => reg.userId)
          .filter((id): id is number => id !== null);
      }
    }

    // AffiliateLead 조건과 랜딩페이지 고객 조건을 OR로 결합
    let whereConditions: Prisma.AffiliateLeadWhereInput[] = [];

    // 전화상담고객 필터 (source=mall)
    if (source === 'mall') {
      // 대리점장: 본인 + 소속 판매원의 문의고객
      if (profile.type === 'BRANCH_MANAGER') {
        const agentIds = profile.managedAgents?.map(a => a.id) || [];

        // agentId 필터가 있는 경우
        if (agentIdParam) {
          if (agentIdParam === 'unassigned') {
            // 미할당 고객
            whereConditions = [
              {
                AND: [
                  { managerId: profile.id },
                  { agentId: null },
                  {
                    OR: [
                      { source: { startsWith: 'mall-' } },
                      { source: 'product-inquiry' },
                      { source: 'phone-consultation' },
                    ],
                  },
                ],
              },
            ];
          } else {
            // 특정 판매원
            const targetAgentId = parseInt(agentIdParam, 10);
            if ([profile.id, ...agentIds].includes(targetAgentId)) {
              whereConditions = [
                {
                  AND: [
                    { agentId: targetAgentId },
                    {
                      OR: [
                        { source: { startsWith: 'mall-' } },
                        { source: 'product-inquiry' },
                        { source: 'phone-consultation' },
                      ],
                    },
                  ],
                },
              ];
            } else {
              whereConditions = [{ id: -1 }];
            }
          }
        } else {
          // agentId 필터 없음
          whereConditions = [
            {
              AND: [
                {
                  OR: [
                    { managerId: profile.id },
                    { agentId: { in: [profile.id, ...agentIds] } },
                  ],
                },
                {
                  OR: [
                    { source: { startsWith: 'mall-' } },
                    { source: 'product-inquiry' },
                    { source: 'phone-consultation' }, // 전화상담 신청 추가
                  ],
                },
              ],
            },
          ];
        }
      } else {
        // 판매원: 자신의 몰 문의고객만
        whereConditions = [
          {
            AND: [
              { agentId: profile.id },
              {
                OR: [
                  { source: { startsWith: 'mall-' } },
                  { source: 'product-inquiry' },
                  { source: 'phone-consultation' }, // 전화상담 신청 추가
                ],
              },
            ],
          },
        ];
      }
    } else {
      // 일반 고객 (기존 로직)
      if (profile.type === 'HQ') {
        // 본사(HQ): 모든 고객 접근 가능
        whereConditions = [{}]; // 빈 조건 = 모든 고객
      } else if (profile.type === 'BRANCH_MANAGER') {
        // 대리점장: 본인 고객 + 소속 판매원 고객
        const agentIds = profile.managedAgents?.map(a => a.id) || [];

        // agentId 필터가 있는 경우
        if (agentIdParam) {
          if (agentIdParam === 'unassigned') {
            // 미할당 고객 (managerId는 있지만 agentId가 없음)
            whereConditions = [
              {
                AND: [
                  { managerId: profile.id },
                  { agentId: null },
                ],
              },
            ];
          } else {
            // 특정 판매원의 고객
            const targetAgentId = parseInt(agentIdParam, 10);
            // 권한 확인: 해당 판매원이 이 대리점장 소속인지 확인
            if ([profile.id, ...agentIds].includes(targetAgentId)) {
              whereConditions = [
                { agentId: targetAgentId },
              ];
            } else {
              // 권한 없음 - 빈 결과 반환
              whereConditions = [{ id: -1 }];
            }
          }
        } else {
          // agentId 필터 없음: 전체 고객
          whereConditions = [
            {
              OR: [
                { managerId: profile.id },
                { agentId: { in: [profile.id, ...agentIds] } },
              ],
            },
          ];
        }
      } else if (profile.type === 'SALES_AGENT') {
        // 판매원: 자신의 고객만
        whereConditions = [
          { agentId: profile.id },
        ];
      } else {
        // 기타: 본인 고객
        whereConditions = [
          { OR: [{ managerId: profile.id }, { agentId: profile.id }] },
        ];
      }
    }

    // 랜딩페이지로 유입된 고객이 있고, 해당 고객의 전화번호로 AffiliateLead를 찾는 경우
    if (landingPageUserIds.length > 0) {
      // User의 전화번호 조회
      const landingPageUsers = await prisma.user.findMany({
        where: {
          id: { in: landingPageUserIds },
        },
        select: {
          phone: true,
        },
      });

      const landingPagePhones = landingPageUsers
        .map(u => u.phone)
        .filter((phone): phone is string => phone !== null);

      if (landingPagePhones.length > 0) {
        // 랜딩페이지로 유입된 고객의 전화번호로 AffiliateLead 찾기
        whereConditions.push({
          customerPhone: { in: landingPagePhones },
        });
      }
    }

    const where: Prisma.AffiliateLeadWhereInput = {
      OR: whereConditions,
    };

    if (statusFilter) {
      where.status = statusFilter;
    }

    // 유입 경로 필터링 (source='mall'은 이미 위에서 처리됨)
    if (source && source !== 'ALL' && source !== 'mall') {
      // where.OR이 이미 설정되어 있으므로, AND 조건으로 추가해야 함
      const sourceConditions: Prisma.AffiliateLeadWhereInput = {};

      if (source === 'trial') {
        // 3일체험
        sourceConditions.source = { in: ['TRIAL_DASHBOARD', 'test-guide'] };
      } else if (source === 'cruise-guide') {
        // 크루즈가이드 이용
        sourceConditions.source = { in: ['cruise-guide', 'cruise-guide-purchase'] };
      } else if (source === 'manual') {
        // 수동 입력
        sourceConditions.source = { in: ['affiliate-manual', 'partner-manual'] };
      } else if (source === 'product-inquiry') {
        // 상품 문의
        sourceConditions.source = { in: ['product-inquiry', 'phone-consultation'] };
      } else if (source === 'b2b') {
        // B2B 유입
        sourceConditions.source = { in: ['B2B_INFLOW', 'B2B_LANDING', 'B2B_LANDING_ADMIN'] };
      } else {
        // 기타 직접 source 값 지정
        sourceConditions.source = source;
      }

      // 기존 조건과 AND로 결합
      if (where.AND) {
        if (Array.isArray(where.AND)) {
          where.AND.push(sourceConditions);
        } else {
          where.AND = [where.AND, sourceConditions];
        }
      } else {
        where.AND = [sourceConditions];
      }
    } else if (source !== 'mall' && (!source || source === 'ALL')) {
      // source 파라미터가 없거나 ALL일 때는 B2B 관련 소스 제외 (일반 고객 목록)
      // source='mall'일 때는 위에서 이미 처리했으므로 제외
      const excludeB2BCondition = {
        source: {
          notIn: ['B2B_INFLOW', 'B2B_LANDING', 'TRIAL_DASHBOARD', 'B2B_LANDING_ADMIN']
        }
      };

      // AND 조건으로 추가
      if (where.AND) {
        if (Array.isArray(where.AND)) {
          where.AND.push(excludeB2BCondition);
        } else {
          where.AND = [where.AND, excludeB2BCondition];
        }
      } else {
        where.AND = [excludeB2BCondition];
      }
    }

    if (query) {
      const variants = phoneSearchVariants(query);
      const searchCondition = {
        OR: [
          { customerName: { contains: query, mode: 'insensitive' as Prisma.QueryMode } },
          ...(variants.length
            ? variants.map((variant) => ({
              customerPhone: {
                contains: variant,
              },
            }))
            : []),
        ],
      };

      // 기존 AND 조건이 있으면 추가, 없으면 새로 생성
      if (where.AND) {
        if (Array.isArray(where.AND)) {
          where.AND.push(searchCondition);
        } else {
          where.AND = [where.AND, searchCondition];
        }
      } else {
        where.AND = [searchCondition];
      }
    }

    const total = await prisma.affiliateLead.count({ where });

    // 판매원일 때는 최근 상담 기록을 더 많이 가져와서 대리점장/본인 기록 확인
    const interactionTake = profile.type === 'SALES_AGENT' ? 10 : 1;

    console.log('[GET /api/partner/customers] Executing findMany query...', {
      whereConditions: whereConditions.length,
      skip,
      take: limit,
    });
    const leads = await prisma.affiliateLead.findMany({
      where,
      orderBy: buildOrderBy(sort),
      skip,
      take: limit,
      include: {
        ...partnerLeadInclude,
        AffiliateInteraction: {
          ...partnerLeadInclude.AffiliateInteraction,
          take: interactionTake,
        },
        AffiliateSale: {
          ...partnerLeadInclude.AffiliateSale,
          take: 3,
        },
      },
    });
    console.log('[GET /api/partner/customers] Found leads:', leads.length);

    const leadIds = leads.map((lead) => lead.id);
    console.log('[GET /api/partner/customers] Lead IDs:', leadIds);

    // 고객 전화번호로 User 정보 조회 (상태 딱지 표시용 및 고객 그룹 추가용, Trip 정보 포함)
    const customerPhones = leads
      .map((lead) => lead.customerPhone)
      .filter((phone): phone is string => !!phone);

    const usersByPhone = new Map<string, {
      id: number;
      name: string | null;
      testModeStartedAt: Date | null;
      customerStatus: string | null;
      customerSource: string | null;
      role: string | null;
      mallUserId: string | null;
      trips: Array<{
        id: number;
        cruiseName: string | null;
        startDate: Date | null;
        endDate: Date | null;
      }>;
    }>();

    if (customerPhones.length > 0) {
      console.log('[GET /api/partner/customers] Fetching users by phone:', customerPhones.length);
      const users = await prisma.user.findMany({
        where: {
          phone: { in: customerPhones },
        },
        select: {
          id: true,
          phone: true,
          name: true,
          testModeStartedAt: true,
          customerStatus: true,
          customerSource: true,
          role: true,
          mallUserId: true,
        },
      });

      users.forEach((user) => {
        if (user.phone) {
          usersByPhone.set(user.phone, {
            id: user.id,
            name: user.name,
            testModeStartedAt: user.testModeStartedAt,
            customerStatus: user.customerStatus,
            customerSource: user.customerSource,
            role: user.role,
            mallUserId: user.mallUserId,
            trips: [], // UserTrip 모델이 없으므로 빈 배열
          });
        }
      });
    }

    const saleSummaryMap = new Map<
      number,
      {
        totalSalesCount: number;
        totalSalesAmount: number;
        totalNetRevenue: number;
        confirmedSalesCount: number;
        confirmedSalesAmount: number;
        lastSaleAt: string | null;
        lastSaleStatus: string | null;
      }
    >();

    if (leadIds.length) {
      console.log('[GET /api/partner/customers] Fetching sale groups for leads:', leadIds.length);
      const saleGroups = await prisma.affiliateSale.groupBy({
        by: ['leadId', 'status'],
        where: { leadId: { in: leadIds } },
        _count: { _all: true },
        _sum: { saleAmount: true, netRevenue: true },
      });

      saleGroups.forEach((row) => {
        if (row.leadId === null) return;
        const entry =
          saleSummaryMap.get(row.leadId) ?? {
            totalSalesCount: 0,
            totalSalesAmount: 0,
            totalNetRevenue: 0,
            confirmedSalesCount: 0,
            confirmedSalesAmount: 0,
            lastSaleAt: null,
            lastSaleStatus: null,
          };

        entry.totalSalesCount += row._count._all ?? 0;
        entry.totalSalesAmount += row._sum.saleAmount ?? 0;
        entry.totalNetRevenue += row._sum.netRevenue ?? 0;

        if (['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'].includes(row.status)) {
          entry.confirmedSalesCount += row._count._all ?? 0;
          entry.confirmedSalesAmount += row._sum.saleAmount ?? 0;
        }

        saleSummaryMap.set(row.leadId, entry);
      });

      const latestSales = await prisma.affiliateSale.findMany({
        where: { leadId: { in: leadIds } },
        orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
        select: { leadId: true, saleDate: true, status: true },
      });

      for (const sale of latestSales) {
        if (sale.leadId === null) continue;
        const entry = saleSummaryMap.get(sale.leadId);
        if (!entry || entry.lastSaleAt) continue;
        entry.lastSaleAt = sale.saleDate?.toISOString() ?? null;
        entry.lastSaleStatus = sale.status;
        saleSummaryMap.set(sale.leadId, entry);
      }
    }

    // customerSource를 기반으로 customerType 결정하는 함수
    const determineCustomerType = (customerSource: string | null, role: string | null): 'test' | 'cruise-guide' | 'mall' | 'prospect' | 'partner' | 'admin' | undefined => {
      if (customerSource === 'admin' || role === 'admin') {
        return 'admin';
      } else if (customerSource === 'mall-admin') {
        return 'admin'; // mall-admin도 admin으로 처리
      } else if (customerSource === 'mall-signup' || role === 'community') {
        return 'mall';
      } else if (customerSource === 'test-guide' || customerSource === 'test') {
        return 'test';
      } else if (customerSource === 'cruise-guide') {
        return 'cruise-guide';
      } else if (customerSource === 'affiliate-manual' || customerSource === 'product-inquiry' || customerSource === 'phone-consultation') {
        return 'prospect';
      }
      // customerSource가 없거나 알 수 없는 경우, role 기반으로 판단
      if (role === 'admin') {
        return 'admin';
      }
      // 기본값은 prospect (잠재 고객)
      return 'prospect';
    };

    const serialized = leads.map((lead) => {
      const userInfo = lead.customerPhone ? usersByPhone.get(lead.customerPhone) : null;
      const latestTrip = userInfo?.trips?.[0] || null;

      // customerType 결정
      const customerType = userInfo
        ? determineCustomerType(userInfo.customerSource, userInfo.role)
        : 'prospect'; // User가 없으면 prospect

      // status 결정 (User의 customerStatus 사용, 없으면 lead의 status 사용)
      // customerStatus 값 매핑: 'purchase_confirmed' -> 'package', 그 외는 그대로 사용
      let status: 'active' | 'package' | 'dormant' | 'locked' | 'test-locked' | undefined = 'active';
      if (userInfo?.customerStatus) {
        // DB의 customerStatus를 Customer 인터페이스의 status로 매핑
        const dbStatus = userInfo.customerStatus;
        if (dbStatus === 'purchase_confirmed') {
          status = 'package';
        } else if (['active', 'package', 'dormant', 'locked', 'test-locked'].includes(dbStatus)) {
          status = dbStatus as typeof status;
        } else {
          status = 'active'; // 기본값
        }
      } else if (lead.status) {
        // AffiliateLead의 status는 그대로 사용 (이미 올바른 형식)
        status = lead.status as typeof status;
      }

      // 담당자 정보 구성 (affiliateOwnership 형식)
      const ownership = resolveOwnership(profile.id, lead);
      const agentProfile = lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
      const managerProfile = lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;

      let affiliateOwnership: {
        ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
        ownerName: string | null;
        managerProfile: any | null;
      } | null = null;

      if (ownership === 'AGENT' && lead.agentId && agentProfile) {
        affiliateOwnership = {
          ownerType: 'SALES_AGENT' as const,
          ownerName: agentProfile.displayName || null,
          managerProfile: managerProfile ? {
            id: managerProfile.id,
            displayName: managerProfile.displayName,
            nickname: managerProfile.displayName,
            affiliateCode: managerProfile.affiliateCode,
            branchLabel: managerProfile.branchLabel,
            status: 'ACTIVE',
            contactPhone: null,
          } : null,
        };
      } else if (ownership === 'MANAGER' && lead.managerId && managerProfile) {
        affiliateOwnership = {
          ownerType: 'BRANCH_MANAGER' as const,
          ownerName: managerProfile.displayName || null,
          managerProfile: null, // 대리점장은 managerProfile이 없음
        };
      }

      // Customer 인터페이스 구조에 맞게 변환
      return {
        // 필수 필드
        id: userInfo?.id || lead.id, // User가 있으면 User.id, 없으면 lead.id
        name: userInfo?.name || lead.customerName || null,
        phone: lead.customerPhone || null,

        // 선택 필드
        customerType,
        status: status as 'active' | 'package' | 'dormant' | 'locked' | 'test-locked' | undefined,
        role: (userInfo?.role as 'user' | 'admin' | undefined) || 'user',

        // affiliateOwnership
        affiliateOwnership,

        // trips 배열
        trips: userInfo?.trips?.map(trip => ({
          id: trip.id,
          cruiseName: trip.cruiseName,
          startDate: trip.startDate?.toISOString() || null,
          endDate: trip.endDate?.toISOString() || null,
        })) || [],

        // 기존 필드들 (하위 호환성 유지)
        ...serializeLead(lead, {
          ownership: resolveOwnership(profile.id, lead),
          counterpart: resolveCounterpart(profile.type, lead),
          saleSummary:
            saleSummaryMap.get(lead.id) ?? {
              totalSalesCount: 0,
              totalSalesAmount: 0,
              totalNetRevenue: 0,
              confirmedSalesCount: 0,
              confirmedSalesAmount: 0,
              lastSaleAt: null,
              lastSaleStatus: null,
            },
        }),
        // 고객 상태 정보 추가 (딱지 표시용)
        testModeStartedAt: userInfo?.testModeStartedAt?.toISOString() ?? null,
        customerStatus: userInfo?.customerStatus ?? null,
        mallUserId: userInfo?.mallUserId ?? null,
        // User 정보 추가 (고객 그룹 추가용)
        userId: userInfo?.id ?? null,
        userName: userInfo?.name ?? null,
        // 전화상담 고객용 추가 정보 (metadata에서 productName 가져오기)
        cruiseName: latestTrip?.cruiseName || (lead.metadata as any)?.productName || null,
        // customerSource 추가 (딱지 표시용)
        customerSource: userInfo?.customerSource || lead.source || null,
        // AffiliateLead ID 추가 (상세기록용)
        leadId: lead.id,
      };
    });

    // 판매원일 때: 대리점장이나 본인이 기록한 최근 상담이 있는 고객을 우선 정렬
    if (profile.type === 'SALES_AGENT') {
      // 대리점장의 profileId 찾기
      // agentRelations는 requirePartnerContext에서 매핑됨
      const managerProfileId = (profile as any).agentRelations?.[0]?.managerId || null;

      serialized.sort((a, b) => {
        // 각 고객의 상담 기록 중 대리점장이나 본인이 기록한 최근 상담 찾기
        const aRecentByManagerOrSelf = a.interactions?.find(
          (interaction) =>
            interaction.profileId === managerProfileId ||
            interaction.profileId === profile.id
        );
        const bRecentByManagerOrSelf = b.interactions?.find(
          (interaction) =>
            interaction.profileId === managerProfileId ||
            interaction.profileId === profile.id
        );

        // 대리점장이나 본인이 기록한 상담이 최근인 고객을 우선 정렬
        if (aRecentByManagerOrSelf && !bRecentByManagerOrSelf) {
          return -1;
        }
        if (!aRecentByManagerOrSelf && bRecentByManagerOrSelf) {
          return 1;
        }

        // 둘 다 대리점장이나 본인이 기록한 상담이 있거나 둘 다 없는 경우
        // 최근 상담 기록 시간으로 정렬 (최신순)
        if (aRecentByManagerOrSelf && bRecentByManagerOrSelf) {
          const aTime = new Date(aRecentByManagerOrSelf.occurredAt).getTime();
          const bTime = new Date(bRecentByManagerOrSelf.occurredAt).getTime();
          return bTime - aTime;
        }

        // 둘 다 대리점장이나 본인이 기록한 상담이 없는 경우
        // 전체 최근 상담 기록 시간으로 정렬
        const aLatestInteraction = a.interactions?.[0];
        const bLatestInteraction = b.interactions?.[0];

        if (aLatestInteraction && bLatestInteraction) {
          const aTime = new Date(aLatestInteraction.occurredAt).getTime();
          const bTime = new Date(bLatestInteraction.occurredAt).getTime();
          return bTime - aTime;
        }

        // 상담 기록이 있는 고객을 우선 정렬
        if (aLatestInteraction && !bLatestInteraction) {
          return -1;
        }
        if (!aLatestInteraction && bLatestInteraction) {
          return 1;
        }

        // 기본 정렬 (updatedAt 기준)
        return 0;
      });
    }

    return NextResponse.json({
      ok: true,
      customers: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      console.error('[GET /api/partner/customers] PartnerApiError:', {
        message: error.message,
        status: error.status,
        stack: error.stack,
      });
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[GET /api/partner/customers] Unexpected error:', error);
    if (error instanceof Error) {
      console.error('[GET /api/partner/customers] Error name:', error.name);
      console.error('[GET /api/partner/customers] Error message:', error.message);
      console.error('[GET /api/partner/customers] Error stack:', error.stack);
    } else {
      console.error('[GET /api/partner/customers] Non-Error object:', JSON.stringify(error, null, 2));
    }
    return NextResponse.json(
      {
        ok: false,
        message: '고객 목록을 불러오지 못했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const payload = await req.json().catch(() => ({}));

    const customerName = toNullableString(payload.customerName) ?? null;
    const rawPhone = toNullableString(payload.customerPhone);
    const customerPhone = normalizePhoneInput(rawPhone);

    if (!customerName && !customerPhone) {
      throw new PartnerApiError('고객 이름 또는 연락처는 필수입니다.', 400);
    }

    const status =
      ensureValidLeadStatus(payload.status) ??
      (profile.type === 'SALES_AGENT' ? 'IN_PROGRESS' : 'NEW');

    const notes = toNullableString(payload.notes);
    const source = toNullableString(payload.source) ?? 'partner-manual';

    // 중복 리드 확인 (B2B 소스는 중복 허용하되 이전 담당자 정보를 notes에 기록)
    const isB2BSource = source && ['B2B_INFLOW', 'B2B_LANDING', 'TRIAL_DASHBOARD', 'B2B_LANDING_ADMIN'].includes(source);
    let duplicateInfo = '';

    if (customerPhone && isB2BSource) {
      // B2B 소스: 중복이면 이전 담당자 정보를 notes에 추가
      const existingLeads = await prisma.affiliateLead.findMany({
        where: {
          customerPhone,
          status: { not: 'CANCELLED' },
        },
        include: {
          AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
            select: {
              displayName: true,
            },
          },
          AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingLeads.length > 0) {
        const latest = existingLeads[0];
        const managerName = latest.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.displayName;
        const agentName = latest.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName;
        const ownerInfo = agentName || managerName || '본사';
        const registrationDate = new Date(latest.createdAt).toLocaleDateString('ko-KR');

        duplicateInfo = `[중복 DB] 이전 담당자: ${ownerInfo} (등록일: ${registrationDate})`;
      }
    }

    let nextActionAt: Date | null = null;
    if (payload.nextActionAt) {
      const parsed = new Date(payload.nextActionAt);
      if (!Number.isNaN(parsed.getTime())) {
        nextActionAt = parsed;
      }
    }

    const now = new Date();
    const data: any = {
      customerName,
      customerPhone,
      status,
      source,
      notes: duplicateInfo ? (notes ? `${duplicateInfo}\n${notes}` : duplicateInfo) : notes,
      nextActionAt,
      metadata: payload.metadata ?? null,
      updatedAt: now, // 필수 필드
    };

    if (profile.type === 'BRANCH_MANAGER') {
      data.managerId = profile.id;
      const assignedAgentId = payload.agentProfileId ? Number(payload.agentProfileId) : null;
      if (assignedAgentId) {
        // managedRelations는 requirePartnerContext에서 매핑됨
        const hasAgent =
          (profile as any).managedRelations?.some((relation: any) => relation.agent?.id === assignedAgentId) ?? false;
        if (!hasAgent) {
          throw new PartnerApiError('해당 판매원은 대리점장 관리 대상이 아닙니다.', 400);
        }
        data.agentId = assignedAgentId;
      }
    } else if (profile.type === 'SALES_AGENT') {
      data.agentId = profile.id;
      // agentRelations는 requirePartnerContext에서 매핑됨
      const activeManager = (profile as any).agentRelations?.[0]?.managerId;
      if (activeManager) {
        data.managerId = activeManager;
      }
    } else {
      data.managerId = profile.id;
    }

    const lead = await prisma.affiliateLead.create({
      data: data as any, // managerId, agentId 직접 설정을 위한 타입 캐스팅
      include: {
        ...partnerLeadInclude,
        AffiliateInteraction: {
          ...partnerLeadInclude.AffiliateInteraction,
          take: 0,
        },
        AffiliateSale: {
          ...partnerLeadInclude.AffiliateSale,
          take: 0,
        },
      },
    });

    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.lead.created',
        details: {
          leadId: lead.id,
          profileId: profile.id,
          role: profile.type,
        },
      },
    });

    // User 정보 조회 또는 생성 (고객 그룹 추가용)
    let userInfo: { id: number; name: string | null; phone: string | null } | null = null;

    if (lead.customerPhone) {
      // 기존 User 찾기
      userInfo = await prisma.user.findFirst({
        where: { phone: lead.customerPhone },
        select: { id: true, name: true, phone: true },
      });

      // User가 없으면 생성 (고객 그룹 추가를 위해 필요)
      if (!userInfo) {
        console.log('[POST /api/partner/customers] Creating User for customer:', lead.customerPhone);
        try {
          const newUser = await prisma.user.create({
            data: {
              name: lead.customerName || null,
              phone: lead.customerPhone,
              email: null,
              password: '1101', // 기본 비밀번호
              role: 'user',
              customerSource: 'affiliate-manual',
              customerStatus: 'active',
              updatedAt: new Date(),
            },
            select: { id: true, name: true, phone: true },
          });
          userInfo = newUser;
          console.log('[POST /api/partner/customers] Created User:', newUser.id);
        } catch (error: any) {
          // User 생성 실패 (예: 전화번호 중복 등)
          console.error('[POST /api/partner/customers] Failed to create User:', error);
          // User 생성 실패해도 AffiliateLead는 이미 생성되었으므로 계속 진행
        }
      }
    }

    // Google 스프레드시트에 고객 데이터 전송 (고객관리 시트)
    // 담당자 정보 결정
    let channel = '본사';
    let manager = '';
    if (profile.type === 'BRANCH_MANAGER') {
      channel = '대리점장';
      manager = profile.displayName || sessionUser.name || '';
    } else if (profile.type === 'SALES_AGENT') {
      channel = '판매원';
      manager = profile.displayName || sessionUser.name || '';
    }

    // 비동기로 실행 (응답 대기 안 함)
    const backupContext = payload.backupContext as 'group' | 'management' | undefined;

    import('@/lib/google-sheets').then(({ sendToGoogleSheet }) => {
      sendToGoogleSheet({
        name: customerName || '',
        phone: customerPhone || '',
        source: source === 'partner-manual' ? '수동입력' : source,
        productName: '',
        channel,
        manager,
        notes: notes || undefined,
        target: backupContext || 'group',
      });
    });

    // B2B 소스인 경우 B2B 전용 스프레드시트에도 백업 (동기 대기 - Vercel 서버리스 환경 필수)
    if (isB2BSource) {
      try {
        console.log('[Partner Customers] B2B 스프레드시트 백업 시작...');
        const { appendB2BLeadToSheet } = await import('@/lib/google/b2b-backup');
        const backupResult = await appendB2BLeadToSheet({
          name: customerName || '',
          phone: customerPhone || '',
          partnerName: manager || '파트너',
          source: source || 'B2B_LANDING',
          createdAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
          notes: notes || '',
        });
        console.log('[Partner Customers] B2B 스프레드시트 백업 완료:', backupResult);
      } catch (backupErr: any) {
        console.error('[Partner Customers] B2B 백업 실패:', backupErr?.message || backupErr);
      }
    }

    return NextResponse.json({
      ok: true,
      customer: {
        ...serializeLead(lead, {
          ownership: resolveOwnership(profile.id, lead),
          counterpart: resolveCounterpart(profile.type, lead),
          saleSummary: {
            totalSalesCount: 0,
            totalSalesAmount: 0,
            totalNetRevenue: 0,
            confirmedSalesCount: 0,
            confirmedSalesAmount: 0,
            lastSaleAt: null,
            lastSaleStatus: null,
          },
        }),
        // User 정보 추가 (고객 그룹 추가용)
        userId: userInfo?.id ?? null,
        userName: userInfo?.name ?? null,
      },
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('POST /api/partner/customers error:', error);
    return NextResponse.json({ ok: false, message: '고객을 추가하지 못했습니다.' }, { status: 500 });
  }
}
