export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

/**
 * GET /api/pnr/partner/list
 * 대리점장의 예약 목록 조회
 */
export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: 인증된 사용자만 (AUTH 필수)
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    authOnly: true,
    errorMessage: '인증이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 }
      );
    }
    const { profile } = ctx;

    // 대리점장인 경우 팀 판매원들의 ID 목록 조회
    let teamAgentIds: number[] = [];
    if (profile.type === 'BRANCH_MANAGER') {
      const teamRelations = await prisma.gmAffiliateRelation.findMany({
        where: {
          managerId: profile.id,
          status: 'ACTIVE',
        },
        select: {
          agentId: true,
        },
      });
      teamAgentIds = teamRelations
        .map(r => r.agentId)
        .filter((id): id is number => id !== null);
    }

    // 대리점장/판매원이 관리하는 Lead 조회
    // 대리점장인 경우: 자신이 managerId인 Lead + 팀 판매원들이 agentId인 Lead
    // 판매원인 경우: 자신이 agentId인 Lead
    const managedLeads = await prisma.gmAffiliateLead.findMany({
      where: {
        customerPhone: { not: null },
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
          // 대리점장인 경우 팀 판매원들이 관리하는 Lead도 포함
          ...(profile.type === 'BRANCH_MANAGER' && teamAgentIds.length > 0
            ? [{ agentId: { in: teamAgentIds } }]
            : []),
        ],
      },
      take: 2000,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        managerId: true,
        agentId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        source: true,
      },
    });

    // 전화번호를 사용하여 User ID 찾기
    const managedUserIds = new Set<number>();
    // phone digits → lead 매핑 (affiliateOwnership 조회에 사용)
    const phoneDigitsToLead = new Map<string, typeof managedLeads[0]>();

    // 전화번호로 매칭
    const uniquePhoneDigits = new Set<string>();
    managedLeads.forEach(lead => {
      const phone = lead.customerPhone;
      if (phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        if (digits.length >= 10) {
          uniquePhoneDigits.add(digits);
          phoneDigitsToLead.set(digits, lead);
        }
      }
    });

    // userId → lead 매핑 (reservations 응답 시 affiliateOwnership 구성용)
    const userIdToLead = new Map<number, typeof managedLeads[0]>();

    if (uniquePhoneDigits.size > 0) {
      // 전화번호 변형 생성 (하이픈 포함/미포함)
      const phoneVariants = new Set<string>();
      uniquePhoneDigits.forEach(digits => {
        phoneVariants.add(digits); // 숫자만
        if (digits.length === 11) {
          phoneVariants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`); // 010-1234-5678
        } else if (digits.length === 10) {
          phoneVariants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`); // 010-123-4567
        }
      });

      const usersFromPhones = await prisma.gmUser.findMany({
        where: {
          phone: { in: Array.from(phoneVariants) },
        },
        select: {
          id: true,
          phone: true,
        },
      });
      usersFromPhones.forEach(user => {
        managedUserIds.add(user.id);
        if (user.phone) {
          const digits = user.phone.replace(/[^0-9]/g, '');
          const lead = phoneDigitsToLead.get(digits);
          if (lead) userIdToLead.set(user.id, lead);
        }
      });
    }

    const userIdArray = Array.from(managedUserIds);

    // 예약 목록 조회 (대리점장/판매원이 관리하는 고객의 예약)
    // 빈 배열일 때는 쿼리를 실행하지 않음
    let reservations: any[] = [];
    if (userIdArray.length > 0) {
      reservations = await prisma.gmReservation.findMany({
        where: {
          mainUserId: { in: userIdArray },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              customerSource: true,
              role: true,
              customerStatus: true,
              trips: {
                select: {
                  id: true,
                  cruiseName: true,
                  startDate: true,
                  endDate: true,
                },
                orderBy: {
                  startDate: 'desc',
                },
                take: 1,
              },
            },
          },
          trip: {
            select: {
              id: true,
              productCode: true,
              shipName: true,
              departureDate: true,
              endDate: true,
            },
          },
          travelers: {
            select: {
              id: true,
              korName: true,
              engSurname: true,
              engGivenName: true,
              nationality: true,
              gender: true,
              roomNumber: true,
            },
          },
        },
        orderBy: {
          id: 'desc',
        },
        take: 100, // 최대 100개
      });
    }

    // Customer 인터페이스 매핑 로직 (가이드 참고)
    const determineCustomerType = (customerSource: string | null, role: string | null): 'test' | 'cruise-guide' | 'mall' | 'prospect' | 'partner' | 'admin' | undefined => {
      if (customerSource === 'admin' || role === 'admin') {
        return 'admin';
      } else if (customerSource === 'mall-admin') {
        return 'admin';
      } else if (customerSource === 'mall-signup' || role === 'community') {
        return 'mall';
      } else if (customerSource === 'test-guide' || customerSource === 'test') {
        return 'test';
      } else if (customerSource === 'cruise-guide') {
        return 'cruise-guide';
      } else if (customerSource === 'affiliate-manual' || customerSource === 'product-inquiry' || customerSource === 'phone-consultation') {
        return 'prospect';
      }
      if (role === 'admin') {
        return 'admin';
      }
      return 'prospect';
    };

    // affiliateOwnership 조회용 leadMap: userIdToLead에서 직접 사용 (2차 쿼리 불필요)
    const leadMap = userIdToLead;

    // Product 정보 조회 (productCode로 CruiseProduct 조회)
    const productCodeSet = new Set<string>();
    reservations.forEach(r => {
      if (r.trip?.productCode) {
        productCodeSet.add(r.trip.productCode);
      }
    });

    const productMap = new Map<string, any>();
    if (productCodeSet.size > 0) {
      const productCodes = Array.from(productCodeSet);
      const products = await prisma.$queryRaw<Array<{
        productCode: string;
        cruiseLine: string | null;
        shipName: string | null;
        packageName: string | null;
      }>>`SELECT "productCode", "cruiseLine", "shipName", "packageName" FROM "CruiseProduct" WHERE "productCode" = ANY(${productCodes})`;
      products.forEach(product => {
        productMap.set(product.productCode, product);
      });
    }

    return NextResponse.json({
      ok: true,
      reservations: reservations.map((r) => {
        const user = r.user;
        const lead = user ? leadMap.get(user.id) : null;

        // Customer 인터페이스 매핑
        const customerType = user
          ? determineCustomerType(user.customerSource, user.role)
          : 'prospect';

        // status 매핑
        let status: 'active' | 'package' | 'dormant' | 'locked' | 'test-locked' | undefined = 'active';
        if (user?.customerStatus) {
          const dbStatus = user.customerStatus;
          if (dbStatus === 'purchase_confirmed') {
            status = 'package';
          } else if (['active', 'package', 'dormant', 'locked', 'test-locked'].includes(dbStatus)) {
            status = dbStatus as typeof status;
          }
        }

        // affiliateOwnership 구성 (GmAffiliateLead에 AffiliateProfile 관계 없음 - agentId/managerId로 판별)
        let affiliateOwnership: {
          ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
          ownerName: string | null;
          managerProfile: any | null;
        } | null = null;

        if (lead) {
          if (lead.agentId === profile.id) {
            affiliateOwnership = {
              ownerType: 'SALES_AGENT' as const,
              ownerName: lead.customerName || null,
              managerProfile: null,
            };
          } else if (lead.managerId === profile.id) {
            affiliateOwnership = {
              ownerType: 'BRANCH_MANAGER' as const,
              ownerName: lead.customerName || null,
              managerProfile: null,
            };
          }
        }

        // trips 매핑
        const trips = user?.trips?.map((trip: any) => ({
          id: trip.id,
          cruiseName: trip.cruiseName,
          startDate: trip.startDate ? trip.startDate.toISOString() : null,
          endDate: trip.endDate ? trip.endDate.toISOString() : null,
        })) || [];

        return {
          id: r.id,
          totalPeople: r.totalPeople,
          passportStatus: r.passportStatus,
          pnrStatus: r.pnrStatus,
          createdAt: r.createdAt ? r.createdAt.toISOString() : null,
          user: {
            ...user,
            customerType,
            status,
            role: (user?.role as 'user' | 'admin' | undefined) || 'user',
            affiliateOwnership,
            trips,
          },
          trip: r.trip ? {
            id: r.trip.id,
            departureDate: r.trip.departureDate?.toISOString() || null,
            productCode: r.trip.productCode,
            product: r.trip.productCode ? productMap.get(r.trip.productCode) || {
              cruiseLine: null,
              shipName: r.trip.shipName || null,
              packageName: null,
            } : {
              cruiseLine: null,
              shipName: r.trip.shipName || null,
              packageName: null,
            },
          } : null,
          // 여행자 정보
          travelers: r.travelers || [],
          // AffiliateSale 관계가 GmReservation에 없으므로 판매/결제 정보는 별도 조회 필요
          agent: null,
          manager: null,
          salesChannel: '직접 판매',
          salesChannelDetail: '',
          link: null,
          payment: null,
          saleStatus: null,
          saleRefundedAt: null,
          saleDate: null,
        };
      }),
    });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error('GET /api/pnr/partner/list error', {
      error: err instanceof Error ? (err as Error).message : String(err),
      name: (err as any).name,
      status: (err as any).status,
    });
    return NextResponse.json(
      { ok: false, message: (err as any).message || '예약 목록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
