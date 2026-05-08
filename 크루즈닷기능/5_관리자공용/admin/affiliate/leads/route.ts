export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const requestedLimit = parseInt(searchParams.get('limit') ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return phone;
  return phone.replace(/[^0-9]/g, '');
}

export async function GET(req: NextRequest) {
  try {
    logger.log('[admin/affiliate/leads][GET] Request started');

    // 인증 확인
    let sessionUser: { id: number; role: string | null } | null = null;
    try {
      const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
      if (sid) {
        const sess = await prisma.session.findUnique({
          where: { id: sid },
          select: { User: { select: { id: true, role: true } } },
        });
        if (sess?.User) {
          sessionUser = { id: sess.User.id, role: sess.User.role };
        }
      }
      logger.log('[admin/affiliate/leads][GET] Session check result:', sessionUser ? 'found' : 'null');
    } catch (authError: any) {
      console.error('[admin/affiliate/leads][GET] Auth error:', authError);
      console.error('[admin/affiliate/leads][GET] Auth error message:', authError?.message);
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!sessionUser) {
      logger.log('[admin/affiliate/leads][GET] No session user');
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (sessionUser.role !== 'admin') {
      logger.log('[admin/affiliate/leads][GET] Not admin, role:', sessionUser.role);
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    logger.log('[admin/affiliate/leads][GET] Admin authenticated, proceeding with query');

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);

    // 필터 파라미터
    const customerName = searchParams.get('customerName')?.trim() || null;
    const customerPhone = searchParams.get('customerPhone')?.trim() || null;
    const status = searchParams.get('status') || null;
    const managerId = searchParams.get('managerId') ? parseInt(searchParams.get('managerId')!, 10) : null;
    const agentId = searchParams.get('agentId') ? parseInt(searchParams.get('agentId')!, 10) : null;
    const source = searchParams.get('source') || null; // source=mall 파라미터

    // WHERE 조건 구성
    const whereConditions: Prisma.AffiliateLeadWhereInput[] = [];

    // source 필터: mall인 경우 mall-로 시작하거나 product-inquiry, phone-consultation인 것만
    if (source === 'mall') {
      whereConditions.push({
        OR: [
          { source: { startsWith: 'mall-' } },
          { source: 'product-inquiry' },
          { source: 'phone-consultation' }, // 전화상담 신청 추가
        ],
      });
    } else if (source === 'b2b') {
      whereConditions.push({
        source: { in: ['test-guide', 'TRIAL_DASHBOARD', 'B2B_LANDING', 'B2B_INFLOW', 'B2B_LANDING_ADMIN'] }
      });
    } else if (source) {
      whereConditions.push({ source });
    }

    // 검색 조건 (이름 또는 전화번호)
    if (customerName || customerPhone) {
      const searchConditions: Prisma.AffiliateLeadWhereInput[] = [];

      if (customerName) {
        searchConditions.push({
          customerName: { contains: customerName },
        });
      }

      if (customerPhone) {
        const normalizedPhone = normalizePhone(customerPhone);
        if (normalizedPhone) {
          searchConditions.push({
            customerPhone: { contains: normalizedPhone },
          });
        }
      }

      if (searchConditions.length > 0) {
        whereConditions.push({ OR: searchConditions });
      }
    }

    // 상태 필터
    if (status) {
      whereConditions.push({ status: status as any });
    }

    // 담당자 필터
    if (managerId) {
      whereConditions.push({ managerId });
    }

    if (agentId) {
      whereConditions.push({ agentId });
    }

    // 최종 where 조건 구성
    const where: Prisma.AffiliateLeadWhereInput = whereConditions.length > 0
      ? { AND: whereConditions }
      : {};

    // 총 개수 조회
    let total = 0;
    let leads: any[] = [];

    try {
      logger.log('[admin/affiliate/leads][GET] Counting leads with where:', JSON.stringify(where));
      total = await prisma.affiliateLead.count({ where });
      logger.log('[admin/affiliate/leads][GET] Count result:', total);
    } catch (countError: any) {
      console.error('[admin/affiliate/leads][GET] Count error:', countError);
      console.error('[admin/affiliate/leads][GET] Count error message:', countError?.message);
      console.error('[admin/affiliate/leads][GET] Count error code:', countError?.code);
      throw countError;
    }

    // Leads 조회
    try {
      logger.log('[admin/affiliate/leads][GET] Fetching leads, skip:', skip, 'take:', limit);
      // 성능 최적화: include 대신 select 사용
      leads = await prisma.affiliateLead.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          status: true,
          passportRequestedAt: true,
          passportCompletedAt: true,
          lastContactedAt: true,
          createdAt: true,
          updatedAt: true,
          managerId: true,
          agentId: true,
          AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
            select: {
              id: true,
              affiliateCode: true,
              displayName: true,
              branchLabel: true,
            },
          },
          AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
            select: {
              id: true,
              affiliateCode: true,
              displayName: true,
              branchLabel: true,
            },
          },
          _count: {
            select: {
              AffiliateInteraction: true,
              AffiliateSale: true,
            },
          },
          source: true,
          notes: true,
          metadata: true,
        },
      });
      logger.log('[admin/affiliate/leads][GET] Query successful, found', leads.length, 'leads');
    } catch (queryError: any) {
      console.error('[admin/affiliate/leads][GET] Query error:', queryError);
      console.error('[admin/affiliate/leads][GET] Query error message:', queryError?.message);
      console.error('[admin/affiliate/leads][GET] Query error code:', queryError?.code);
      console.error('[admin/affiliate/leads][GET] Query error meta:', queryError?.meta);
      if (queryError?.stack) {
        console.error('[admin/affiliate/leads][GET] Query error stack:', queryError.stack);
      }
      throw queryError;
    }

    // 고객 전화번호로 User 정보 조회 (Trip 정보 포함)
    const customerPhones = leads
      .map((lead: any) => lead.customerPhone)
      .filter((phone): phone is string => !!phone);

    const usersByPhone = new Map<string, {
      id: number;
      name: string | null;
      trips: Array<{
        id: number;
        cruiseName: string | null;
        startDate: Date | null;
        endDate: Date | null;
      }>;
    }>();

    if (customerPhones.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          phone: { in: customerPhones },
        },
        select: {
          id: true,
          phone: true,
          name: true,
        },
      });

      users.forEach((user) => {
        if (user.phone) {
          usersByPhone.set(user.phone, {
            id: user.id,
            name: user.name,
            trips: [], // UserTrip 모델이 없으므로 빈 배열
          });
        }
      });
    }

    // 응답 데이터 형식화
    logger.log('[admin/affiliate/leads][GET] Starting to format', leads.length, 'leads');
    const formattedLeads = leads.map((lead: any) => {
      try {
        const manager = lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
        const agent = lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;

        // User 정보 조회
        const userInfo = lead.customerPhone ? usersByPhone.get(lead.customerPhone) : null;
        const latestTrip = userInfo?.trips?.[0] || null;

        const formatDate = (date: any) => {
          if (!date) return null;
          try {
            if (date instanceof Date) {
              return date.toISOString();
            }
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) {
              return null;
            }
            return parsed.toISOString();
          } catch {
            return null;
          }
        };

        // 담당자 정보 구성 (affiliateOwnership 형식)
        let affiliateOwnership: any = null;
        if (manager || agent) {
          affiliateOwnership = {
            ownerType: agent ? 'SALES_AGENT' : (manager ? 'BRANCH_MANAGER' : 'HQ'),
            ownerName: (agent?.displayName || manager?.displayName) || null,
            ownerNickname: (agent?.displayName || manager?.displayName) || null,
          };
        }

        const formatted = {
          id: lead.id,
          customerName: lead.customerName || null,
          customerPhone: lead.customerPhone || null,
          status: lead.status || null,
          source: lead.source || null,
          notes: lead.notes || null,
          passportRequestedAt: formatDate(lead.passportRequestedAt),
          passportCompletedAt: formatDate(lead.passportCompletedAt),
          lastContactedAt: formatDate(lead.lastContactedAt),
          createdAt: formatDate(lead.createdAt) || new Date().toISOString(),
          manager: manager
            ? {
              id: manager.id || null,
              affiliateCode: manager.affiliateCode || null,
              displayName: manager.displayName || null,
            }
            : null,
          agent: agent
            ? {
              id: agent.id || null,
              affiliateCode: agent.affiliateCode || null,
              displayName: agent.displayName || null,
            }
            : null,
          _count: {
            interactions: (lead._count?.AffiliateInteraction ?? 0) || 0,
            sales: (lead._count?.AffiliateSale ?? 0) || 0,
          },
          // 전화상담 고객용 추가 정보 (metadata에서 productName fallback)
          userId: userInfo?.id || null,
          cruiseName: latestTrip?.cruiseName || (lead.metadata as any)?.productName || null,
          affiliateOwnership,
          // AffiliateLead ID 추가 (상세기록용)
          leadId: lead.id,
        };
        return formatted;
      } catch (itemError: any) {
        console.error(`[admin/affiliate/leads][GET] Error formatting lead ${lead?.id || 'unknown'}:`, itemError);
        console.error(`[admin/affiliate/leads][GET] Lead data:`, JSON.stringify(lead, null, 2).substring(0, 200));
        // 기본 정보만 반환
        return {
          id: lead?.id || 0,
          customerName: lead?.customerName || null,
          customerPhone: lead?.customerPhone || null,
          status: lead?.status || null,
          source: lead?.source || null,
          notes: lead?.notes || null,
          passportRequestedAt: null,
          passportCompletedAt: null,
          lastContactedAt: null,
          createdAt: (() => {
            try {
              if (lead?.createdAt instanceof Date) {
                return lead.createdAt.toISOString();
              }
              if (lead?.createdAt) {
                const parsed = new Date(lead.createdAt);
                if (!isNaN(parsed.getTime())) {
                  return parsed.toISOString();
                }
              }
              return new Date().toISOString();
            } catch {
              return new Date().toISOString();
            }
          })(),
          manager: null,
          agent: null,
          _count: {
            interactions: 0,
            sales: 0,
          },
          userId: null,
          cruiseName: null,
          affiliateOwnership: null,
        };
      }
    });
    logger.log('[admin/affiliate/leads][GET] Formatted', formattedLeads.length, 'leads successfully');

    return NextResponse.json({
      ok: true,
      leads: formattedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[admin/affiliate/leads][GET] Error:', error);
    console.error('[admin/affiliate/leads][GET] Error message:', error?.message);
    console.error('[admin/affiliate/leads][GET] Error code:', error?.code);
    console.error('[admin/affiliate/leads][GET] Error meta:', error?.meta);
    if (error?.stack) {
      console.error('[admin/affiliate/leads][GET] Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        ok: false,
        message: '고객 목록을 불러오지 못했습니다.',
        error: error?.message || String(error),
        ...(process.env.NODE_ENV === 'development' ? {
          details: {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack,
          }
        } : {})
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 새 AffiliateLead 생성 (관리자용)
 */
export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    let sessionUser: { id: number; role: string | null } | null = null;
    try {
      const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
      if (sid) {
        const sess = await prisma.session.findUnique({
          where: { id: sid },
          select: { User: { select: { id: true, role: true } } },
        });
        if (sess?.User) {
          sessionUser = { id: sess.User.id, role: sess.User.role };
        }
      }
    } catch (authError: any) {
      console.error('[admin/affiliate/leads][POST] Auth error:', authError);
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { customerName, customerPhone, managerId, agentId, status, source, notes } = body;

    // 필수 필드 검증
    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { ok: false, message: '고객 이름과 전화번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 정규화
    const normalizedPhone = normalizePhone(customerPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return NextResponse.json(
        { ok: false, message: '유효한 전화번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 기존 리드 확인 (B2B 소스는 중복 허용하되 이전 담당자 정보를 notes에 기록, 일반 소스만 중복 방지)
    const isB2BSource = source && ['B2B_INFLOW', 'B2B_LANDING', 'TRIAL_DASHBOARD', 'B2B_LANDING_ADMIN'].includes(source);
    let duplicateInfo = '';

    if (isB2BSource) {
      // B2B 소스: 중복이면 이전 담당자 정보를 notes에 추가
      const existingLeads = await prisma.affiliateLead.findMany({
        where: {
          customerPhone: normalizedPhone,
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
    } else {
      // 일반 소스: 중복 방지
      const existingLead = await prisma.affiliateLead.findFirst({
        where: {
          customerPhone: normalizedPhone,
          status: { not: 'CANCELLED' },
        },
      });

      if (existingLead) {
        return NextResponse.json(
          { ok: false, message: '이미 존재하는 고객입니다. 기존 리드를 수정해주세요.', leadId: existingLead.id },
          { status: 400 }
        );
      }
    }

    // 대리점장/판매원 검증
    if (managerId) {
      const managerProfile = await prisma.affiliateProfile.findFirst({
        where: {
          id: parseInt(String(managerId)),
          type: 'BRANCH_MANAGER',
          status: 'ACTIVE',
        },
      });
      if (!managerProfile) {
        return NextResponse.json({ ok: false, message: 'Invalid manager ID' }, { status: 400 });
      }
    }

    if (agentId) {
      const agentProfile = await prisma.affiliateProfile.findFirst({
        where: {
          id: parseInt(String(agentId)),
          type: 'SALES_AGENT',
          status: 'ACTIVE',
        },
      });
      if (!agentProfile) {
        return NextResponse.json({ ok: false, message: 'Invalid agent ID' }, { status: 400 });
      }

      // 판매원이 선택된 경우 해당 판매원의 대리점장도 자동 설정 (managerId가 없을 때만)
      if (!managerId) {
        const relation = await prisma.affiliateRelation.findFirst({
          where: {
            agentId: parseInt(String(agentId)),
            status: 'ACTIVE',
          },
          select: { managerId: true },
        });
        if (relation) {
          // managerId를 relation.managerId로 설정
          const finalManagerId = relation.managerId;
          const newLead = await prisma.affiliateLead.create({
            data: {
              customerName: customerName.trim(),
              customerPhone: normalizedPhone,
              managerId: finalManagerId,
              agentId: parseInt(String(agentId)),
              status: status || 'NEW',
              source: source || 'admin-manual',
              notes: duplicateInfo ? (notes ? `${duplicateInfo}\n${notes}` : duplicateInfo) : (notes || null),
            },
            include: {
              AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
                select: {
                  id: true,
                  affiliateCode: true,
                  displayName: true,
                  branchLabel: true,
                },
              },
              AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  affiliateCode: true,
                  displayName: true,
                },
              },
            },
          });

          // 생성 이력 기록
          await prisma.affiliateInteraction.create({
            data: {
              leadId: newLead.id,
              profileId: null,
              createdById: sessionUser.id,
              interactionType: 'UPDATED',
              note: `리드가 생성되었습니다. 담당 대리점장: ${newLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.displayName || '없음'}, 담당 판매원: ${newLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || '없음'}`,
              metadata: {
                createdBy: 'admin',
                createdAt: new Date().toISOString(),
                managerId: finalManagerId,
                agentId: parseInt(String(agentId)),
              },
            },
          });

          return NextResponse.json({
            ok: true,
            lead: {
              ...newLead,
              manager: newLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile,
              agent: newLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile,
            },
            message: '리드가 생성되었습니다.',
          });
        }
      }
    }

    // 리드 생성
    const newLead = await prisma.affiliateLead.create({
      data: {
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        managerId: managerId ? parseInt(String(managerId)) : null,
        agentId: agentId ? parseInt(String(agentId)) : null,
        status: status || 'NEW',
        source: source || 'admin-manual',
        notes: duplicateInfo ? (notes ? `${duplicateInfo}\n${notes}` : duplicateInfo) : (notes || null),
      },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            branchLabel: true,
          },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
          },
        },
      },
    });

    // 생성 이력 기록
    await prisma.affiliateInteraction.create({
      data: {
        leadId: newLead.id,
        profileId: null,
        createdById: sessionUser.id,
        interactionType: 'UPDATED',
        note: `리드가 생성되었습니다. 담당 대리점장: ${newLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.displayName || '없음'}, 담당 판매원: ${newLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || '없음'}`,
        metadata: {
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
          managerId: managerId ? parseInt(String(managerId)) : null,
          agentId: agentId ? parseInt(String(agentId)) : null,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      lead: {
        ...newLead,
        manager: newLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile,
        agent: newLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile,
      },
      message: '리드가 생성되었습니다.',
    });
  } catch (error: any) {
    console.error('[admin/affiliate/leads][POST] Error:', error);
    return NextResponse.json(
      { ok: false, message: '리드 생성에 실패했습니다.', error: error?.message || String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 리드 삭제 (관리자용)
 */
export async function DELETE(req: NextRequest) {
  try {
    // 인증 확인
    let sessionUser: { id: number; role: string | null } | null = null;
    try {
      const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
      if (sid) {
        const sess = await prisma.session.findUnique({
          where: { id: sid },
          select: { User: { select: { id: true, role: true } } },
        });
        if (sess?.User) {
          sessionUser = { id: sess.User.id, role: sess.User.role };
        }
      }
    } catch (authError: any) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, message: '삭제할 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 관련 데이터 삭제 후 리드 삭제
    await prisma.$transaction(async (tx) => {
      // 1. 관련 상호작용 삭제
      await tx.affiliateInteraction.deleteMany({
        where: { leadId: { in: ids } },
      });

      // 2. 관련 판매 기록 확인 (판매 기록이 있으면 삭제 불가 정책일 수 있음 - 여기서는 일단 진행하거나 에러 처리)
      // 판매 기록이 있는 리드는 삭제하지 않도록 필터링할 수도 있음.
      // 여기서는 판매 기록이 있으면 외래키 제약조건으로 에러가 날 수 있으므로 확인 필요.
      // 하지만 요구사항이 "삭제 가능하게" 이므로 강제 삭제를 원할 수도 있음.
      // 안전을 위해 판매 기록이 있는 리드는 제외하고 삭제하거나, 판매 기록도 같이 삭제(위험)해야 함.
      // 일단 판매 기록이 있는 리드는 삭제 실패하도록 놔두거나, 미리 체크.

      // 리드 삭제
      await tx.affiliateLead.deleteMany({
        where: { id: { in: ids } },
      });
    });

    return NextResponse.json({
      ok: true,
      message: `${ids.length}개의 항목이 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error('[admin/affiliate/leads][DELETE] Error:', error);
    // 외래키 제약 조건 에러 처리 (P2003)
    if (error.code === 'P2003') {
      return NextResponse.json(
        { ok: false, message: '판매 기록이 있는 고객은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, message: '삭제 중 오류가 발생했습니다.', error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
