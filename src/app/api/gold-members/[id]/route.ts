export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET: 골드회원 상세
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    const { id } = await context.params;

    const member = await prisma.goldMember.findUnique({
      where: { id },
      include: {
        consultations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!member) return NextResponse.json({ ok: false, error: '없음' }, { status: 404 });

    // 조직 격리: GLOBAL_ADMIN이 아니면 자기 조직 회원만 조회 가능
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.organizationId && member.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, member });
  } catch (err) {
    logger.error('[GET /api/gold-members/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

// PATCH: 정보 수정 (상태, 납부 횟수, 메모 등)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    const { id } = await context.params;

    const body = await req.json() as Partial<{
      name: string;
      phone: string;
      email: string;
      courseType: string;
      joinDate: string;
      paymentDay: number;
      totalPayments: number;
      paidCount: number;
      status: string;
      memo: string;
    }>;

    const data: Record<string, unknown> = {};
    if (body.name        !== undefined) data.name         = body.name;
    if (body.phone       !== undefined) data.phone        = body.phone.replace(/[^0-9]/g, '');
    if (body.email       !== undefined) data.email        = body.email || null;
    const VALID_COURSE_TYPES = ['A', 'B', 'C', 'HEALTH'];
    const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];

    if (body.courseType !== undefined && !VALID_COURSE_TYPES.includes(body.courseType)) {
      return NextResponse.json({ ok: false, error: '코스는 A, B, C 중 하나여야 합니다.' }, { status: 400 });
    }
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 상태입니다.' }, { status: 400 });
    }
    if (body.paymentDay !== undefined && (body.paymentDay < 1 || body.paymentDay > 31)) {
      return NextResponse.json({ ok: false, error: '납부일은 1~31 사이여야 합니다.' }, { status: 400 });
    }

    if (body.courseType  !== undefined) data.courseType   = body.courseType;
    if (body.joinDate    !== undefined) data.joinDate     = new Date(body.joinDate);
    if (body.paymentDay  !== undefined) data.paymentDay   = body.paymentDay;
    if (body.totalPayments !== undefined) data.totalPayments = body.totalPayments;
    if (body.paidCount   !== undefined) data.paidCount    = body.paidCount;
    if (body.status      !== undefined) data.status       = body.status;
    if (body.memo        !== undefined) data.memo         = body.memo || null;

    // P0: organizationId 격리 — 다른 조직의 골드회원 수정 방지
    const existing = await prisma.goldMember.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '없음' }, { status: 404 });
    }
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.organizationId && existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const member = await prisma.goldMember.update({ where: { id }, data });
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    logger.error('[PATCH /api/gold-members/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
