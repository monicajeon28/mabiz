export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { getAffiliateRoleFilter } from '@/lib/affiliate-filters';

const VALID_TIERS = [33000, 66000, 99000];

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * GET /api/admin/gold-members
 * 역할별 골드회원 목록 조회
 * - admin/superadmin: 전체 목록
 * - BRANCH_MANAGER: managerId 일치 항목만
 * - SALES_AGENT: agentId 일치 항목만
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const roleFilter = await getAffiliateRoleFilter(sessionUser.id);
    if (!roleFilter) {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }
    const { managerFilter, agentFilter, subAgentIds } = roleFilter;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const statusFilter = searchParams.get('status') || null;

    // WHERE 조건 구성
    const whereConditions: Prisma.GoldMemberWhereInput[] = [];
    if (statusFilter) whereConditions.push({ status: statusFilter });
    if (managerFilter !== undefined) {
      if (subAgentIds.length > 0) {
        whereConditions.push({ OR: [{ managerId: managerFilter }, { agentId: { in: subAgentIds } }] });
      } else {
        whereConditions.push({ managerId: managerFilter });
      }
    }
    if (agentFilter !== undefined) whereConditions.push({ agentId: agentFilter });
    const where: Prisma.GoldMemberWhereInput = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [members, total] = await Promise.all([
      prisma.goldMember.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goldMember.count({ where }),
    ]);

    const now = new Date();
    const formattedMembers = members.map((m) => {
      const startDate = new Date(m.startDate);
      const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...m,
        daysSinceStart,
      };
    });

    return NextResponse.json({
      ok: true,
      members: formattedMembers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    logger.error('[admin/gold-members][GET] 조회 실패', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, message: '골드회원 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/gold-members
 * 신규 골드회원 등록 (admin 전용)
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (!userRecord || !['admin', 'superadmin'].includes(userRecord.role ?? '')) {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, email, tier, startDate, referredBy, managerId, agentId, memo } = body as {
      name?: string;
      phone?: string;
      email?: string;
      tier?: number;
      startDate?: string;
      referredBy?: string;
      managerId?: number;
      agentId?: number;
      memo?: string;
    };

    // 필수 필드 검증
    if (!name || !phone || !tier || !startDate) {
      return NextResponse.json(
        { ok: false, message: 'name, phone, tier, startDate는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // tier 값 검증
    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json(
        { ok: false, message: `tier는 ${VALID_TIERS.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    // startDate 파싱
    const parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 startDate 형식입니다.' }, { status: 400 });
    }
    parsedStartDate.setUTCHours(0, 0, 0, 0);

    // managerId 존재 확인
    if (managerId) {
      const manager = await prisma.affiliateProfile.findFirst({
        where: { id: managerId, type: 'BRANCH_MANAGER', status: 'ACTIVE' },
      });
      if (!manager) {
        return NextResponse.json({ ok: false, message: '유효하지 않은 managerId입니다.' }, { status: 400 });
      }
    }

    // agentId 존재 확인
    if (agentId) {
      const agent = await prisma.affiliateProfile.findFirst({
        where: { id: agentId, type: 'SALES_AGENT', status: 'ACTIVE' },
      });
      if (!agent) {
        return NextResponse.json({ ok: false, message: '유효하지 않은 agentId입니다.' }, { status: 400 });
      }
    }

    const created = await prisma.goldMember.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() ?? null,
        tier,
        startDate: parsedStartDate,
        referredBy: referredBy?.trim() ?? null,
        managerId: managerId ?? null,
        agentId: agentId ?? null,
        memo: memo?.trim() ?? null,
        updatedAt: new Date(),
      },
    });

    logger.debug('[admin/gold-members][POST] 골드회원 등록', {
      id: created.id,
      tier: created.tier,
      createdBy: sessionUser.id,
    });

    return NextResponse.json({
      ok: true,
      member: { id: created.id, name: created.name, tier: created.tier, status: created.status, createdAt: created.createdAt },
    }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[admin/gold-members][POST] 등록 실패', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, message: '골드회원 등록에 실패했습니다.' }, { status: 500 });
  }
}
