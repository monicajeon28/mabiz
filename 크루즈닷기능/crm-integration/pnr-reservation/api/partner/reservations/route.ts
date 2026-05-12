export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/reservations
 * 대리점장의 예약 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();

    // 대리점장인 경우 팀 판매원들의 ID 목록 조회
    let teamAgentIds: number[] = [];
    if (profile.type === 'BRANCH_MANAGER') {
      const teamRelations = await prisma.affiliateRelation.findMany({
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
    const managedLeads = await prisma.affiliateLead.findMany({
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
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: { id: true, displayName: true, affiliateCode: true, branchLabel: true },
        },
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: { id: true, displayName: true, affiliateCode: true, branchLabel: true },
        },
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

      const usersFromPhones = await prisma.user.findMany({
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
      reservations = await prisma.reservation.findMany({
        where: {
          mainUserId: { in: userIdArray },
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              customerSource: true,
              role: true,
              customerStatus: true,
              UserTrip: {
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
          Trip: {
            select: {
              id: true,
              productCode: true,
              shipName: true,
              departureDate: true,
              endDate: true,
            },
          },
          Traveler: {
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
          AffiliateSale: {
            select: {
              id: true,
              status: true,
              saleDate: true,
              refundedAt: true,
              createdAt: true,
              updatedAt: true,
              AffiliateProfile_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  type: true,
                },
              },
              AffiliateProfile_managerIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  type: true,
                },
              },
              AffiliateLink: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                },
              },
              Payment: {
                select: {
                  id: true,
                  orderId: true,
                  amount: true,
                  status: true,
                  paidAt: true,
                  cancelledAt: true,
                  pgTransactionId: true,
                  buyerName: true,
                  buyerTel: true,
                  pgProvider: true,
                  metadata: true,
                },
              },
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
      if (r.Trip?.productCode) {
        productCodeSet.add(r.Trip.productCode);
      }
    });
    
    const productMap = new Map<string, any>();
    if (productCodeSet.size > 0) {
      const products = await prisma.cruiseProduct.findMany({
        where: {
          productCode: { in: Array.from(productCodeSet) },
        },
        select: {
          productCode: true,
          cruiseLine: true,
          shipName: true,
          packageName: true,
        },
      });
      products.forEach(product => {
        productMap.set(product.productCode, product);
      });
    }

    return NextResponse.json({
      ok: true,
      reservations: reservations.map((r) => {
        const user = r.User;
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
        
        // affiliateOwnership 구성
        let affiliateOwnership: {
          ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
          ownerName: string | null;
          managerProfile: any | null;
        } | null = null;
        
        if (lead) {
          const agentProfile = lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
          const managerProfile = lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
          
          if (lead.agentId === profile.id && agentProfile) {
            affiliateOwnership = {
              ownerType: 'SALES_AGENT' as const,
              ownerName: agentProfile.displayName || null,
              managerProfile: managerProfile ? {
                id: managerProfile.id,
                displayName: managerProfile.displayName,
                affiliateCode: managerProfile.affiliateCode,
                branchLabel: managerProfile.branchLabel,
              } : null,
            };
          } else if (lead.managerId === profile.id && managerProfile) {
            affiliateOwnership = {
              ownerType: 'BRANCH_MANAGER' as const,
              ownerName: managerProfile.displayName || null,
              managerProfile: null,
            };
          }
        }
        
        // trips 매핑
        const trips = user?.UserTrip?.map(trip => ({
          id: trip.id,
          cruiseName: trip.cruiseName,
          startDate: trip.startDate ? trip.startDate.toISOString() : null,
          endDate: trip.endDate ? trip.endDate.toISOString() : null,
        })) || [];
        
        // 결제 정보 및 판매 채널 추출
        const paymentMetadata = r.AffiliateSale?.Payment?.metadata as Record<string, any> | null;
        const payMethod = paymentMetadata?.payMethod || paymentMetadata?.pay_method || r.AffiliateSale?.Payment?.pgProvider || null;

        const agent = r.AffiliateSale?.AffiliateProfile_agentIdToAffiliateProfile;
        const manager = r.AffiliateSale?.AffiliateProfile_managerIdToAffiliateProfile;
        const link = r.AffiliateSale?.AffiliateLink;

        let salesChannel = '직접 판매';
        let salesChannelDetail = '';

        if (link) {
          salesChannel = link.title || `링크(${link.code})`;
          salesChannelDetail = link.code;
        } else if (agent) {
          salesChannel = agent.displayName || '판매원';
          salesChannelDetail = agent.type === 'SALES' ? '판매원' : agent.type === 'BRANCH' ? '대리점장' : agent.type || '';
        }

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
          trip: r.Trip ? {
            id: r.Trip.id,
            departureDate: r.Trip.departureDate?.toISOString() || null,
            productCode: r.Trip.productCode,
            product: r.Trip.productCode ? productMap.get(r.Trip.productCode) || {
              cruiseLine: null,
              shipName: r.Trip.shipName || null,
              packageName: null,
            } : {
              cruiseLine: null,
              shipName: r.Trip.shipName || null,
              packageName: null,
            },
          } : null,
          // 여행자 정보
          travelers: r.Traveler || [],
          // 판매원 정보
          agent: agent ? {
            id: agent.id,
            displayName: agent.displayName,
            type: agent.type,
          } : null,
          // 대리점장 정보
          manager: manager ? {
            id: manager.id,
            displayName: manager.displayName,
            type: manager.type,
          } : null,
          // 판매 채널 정보
          salesChannel,
          salesChannelDetail,
          // 판매 링크 정보
          link: link ? {
            id: link.id,
            code: link.code,
            title: link.title,
          } : null,
          // 결제 정보
          payment: r.AffiliateSale?.Payment ? {
            id: r.AffiliateSale.Payment.id,
            orderId: r.AffiliateSale.Payment.orderId,
            amount: r.AffiliateSale.Payment.amount,
            status: r.AffiliateSale.Payment.status,
            paidAt: r.AffiliateSale.Payment.paidAt?.toISOString(),
            cancelledAt: r.AffiliateSale.Payment.cancelledAt?.toISOString(),
            pgTransactionId: r.AffiliateSale.Payment.pgTransactionId,
            buyerName: r.AffiliateSale.Payment.buyerName,
            buyerTel: r.AffiliateSale.Payment.buyerTel,
            payMethod: payMethod,
          } : null,
          // 판매/환불 상태
          saleStatus: r.AffiliateSale?.status || null,
          saleRefundedAt: r.AffiliateSale?.refundedAt?.toISOString() || null,
          saleDate: r.AffiliateSale?.saleDate?.toISOString() || r.AffiliateSale?.createdAt?.toISOString() || null,
        };
      }),
    });
  } catch (error: any) {
    logger.error('GET /api/partner/reservations error', {
      error: error instanceof Error ? error.message : String(error),
      name: error.name,
      status: error.status,
    });
    return NextResponse.json(
      { ok: false, message: error.message || '예약 목록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

