export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '***-****';
  // 국제번호(+82) → 0으로 정규화
  const normalized = digits.startsWith('82') && digits.length >= 11
    ? '0' + digits.slice(2)
    : digits;
  return normalized.slice(0, 3) + '-****-' + normalized.slice(-4);
}

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
    if (!member || member.deletedAt !== null) return NextResponse.json({ ok: false, error: '없음' }, { status: 404 });

    // 조직 격리: GLOBAL_ADMIN이 아니면 자기 조직 회원만 조회 가능
    if (ctx.role !== 'GLOBAL_ADMIN') {
      if (!ctx.organizationId || member.organizationId !== ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
      }
      // AGENT는 자기 담당 고객(agentId = 본인 userId)만 조회
      // NaN이면 agentId 비교를 건너뛰지 않고 명시적으로 403 반환
      if (ctx.role === 'AGENT') {
        const numericId = parseInt(ctx.userId, 10);
        if (isNaN(numericId)) {
          return NextResponse.json({ ok: false, error: '사용자 ID 오류' }, { status: 403 });
        }
        if (member.agentId !== numericId) {
          return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
        }
      }
    }

    // NEW-2(P2): 전화번호 마스킹 — GLOBAL_ADMIN만 원본 반환, 나머지는 마스킹
    const safeMember = {
      ...member,
      phone: ctx.role !== 'GLOBAL_ADMIN' ? maskPhone(member.phone) : member.phone,
    };

    return NextResponse.json({ ok: true, member: safeMember });
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
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
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
      agentId: number | string | null;
      managerId: number | string | null;
    }>;

    const data: Record<string, unknown> = {};
    if (body.name        !== undefined) data.name         = body.name;
    if (body.phone       !== undefined) data.phone        = body.phone.replace(/[^0-9]/g, '');
    if (body.email       !== undefined) data.email        = body.email || null;
    const VALID_COURSE_TYPES = ['A', 'B', 'C', 'HEALTH'];
    const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];

    if (body.courseType !== undefined && !VALID_COURSE_TYPES.includes(body.courseType)) {
      return NextResponse.json({ ok: false, error: '코스는 A, B, C, 건강 중 하나여야 합니다.' }, { status: 400 });
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
    if (body.agentId !== undefined) {
      const parsed = body.agentId !== null ? parseInt(String(body.agentId), 10) : null;
      data.agentId = (parsed !== null && !isNaN(parsed)) ? parsed : null;
    }
    if (body.managerId !== undefined) {
      const parsed = body.managerId !== null ? parseInt(String(body.managerId), 10) : null;
      data.managerId = (parsed !== null && !isNaN(parsed)) ? parsed : null;
    }

    // P0: organizationId 격리 — 다른 조직의 골드회원 수정 방지
    const existing = await prisma.goldMember.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '없음' }, { status: 404 });
    }
    if (ctx.role !== 'GLOBAL_ADMIN') {
      if (!ctx.organizationId || existing.organizationId !== ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const updated = await prisma.goldMember.updateMany({
      where: { id, ...(ctx.role !== 'GLOBAL_ADMIN' ? { organizationId: ctx.organizationId ?? '__IMPOSSIBLE__' } : {}) },
      data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ ok: false, error: '없음' }, { status: 404 });
    }
    // B3: 업데이트된 최신 데이터를 조회해 반환 (로컬 상태 갱신 보장)
    const updatedMember = await prisma.goldMember.findUnique({
      where: { id },
      include: { consultations: { orderBy: { createdAt: 'desc' } } },
    });
    return NextResponse.json({ ok: true, member: updatedMember });
  } catch (err) {
    logger.error('[PATCH /api/gold-members/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

// DELETE: 골드회원 소프트삭제 (GLOBAL_ADMIN 전용)
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자만 직접 삭제할 수 있습니다.' }, { status: 403 });
    }
    const { id } = await context.params;

    const existing = await prisma.goldMember.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '없음' }, { status: 404 });
    }
    if (existing.deletedAt !== null) {
      return NextResponse.json({ ok: false, error: '이미 삭제된 회원입니다.' }, { status: 409 });
    }

    await prisma.goldMember.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/gold-members/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
