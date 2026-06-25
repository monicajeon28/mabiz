export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

function generateMemberCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET: 골드회원 목록
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
    const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const status     = searchParams.get('status') ?? '';
    const courseType = searchParams.get('courseType') ?? '';
    const q          = searchParams.get('q')?.trim() ?? '';

    const where: Record<string, unknown> = { deletedAt: null };
    if (ctx.role === 'GLOBAL_ADMIN') {
      // GLOBAL_ADMIN은 전체 조회 (organizationId 필터 없음)
    } else {
      if (!ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
      }
      where.organizationId = ctx.organizationId;
      // AGENT는 자기 담당 고객(agentId = 본인 userId)만 조회
      // NaN이면 agentId 필터 없이 전체가 노출되므로 명시적으로 차단
      if (ctx.role === 'AGENT') {
        const numericId = parseInt(ctx.userId, 10);
        if (isNaN(numericId)) {
          return NextResponse.json({ ok: false, error: '사용자 ID 오류' }, { status: 403 });
        }
        where.agentId = numericId;
      }
    }
    if (status) where.status = status;
    if (courseType) where.courseType = courseType;
    if (q) where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { memberCode: { contains: q.toUpperCase() } },
    ];

    // P1: Prisma 쿼리 타임아웃 (5초) 추가
    let members, total;
    try {
      const [m, t] = await Promise.race([
        Promise.all([
          prisma.goldMember.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: { _count: { select: { consultations: true } } },
          }),
          prisma.goldMember.count({ where }),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout (5s)')), 5000)
        ),
      ]);
      members = m;
      total = t;
    } catch (err) {
      if (err instanceof Error && err.message.includes('timeout')) {
        logger.warn('[GET /api/gold-members] Query timeout', { page, limit, query: q });
        return NextResponse.json(
          { ok: false, error: '쿼리 타임아웃: 잠시 후 다시 시도해 주세요.' },
          { status: 504 }
        );
      }
      throw err;
    }

    // agentId(Int) → 표시 이름 조회: User.phone → OrganizationMember.displayName 순서로 시도
    const agentIds = [...new Set(members.map((m) => m.agentId).filter((id): id is number => id != null))];
    const agentNameMap = new Map<number, string>();
    if (agentIds.length > 0) {
      try {
        type UserNameRow = { id: number; name: string | null; phone: string | null };
        const userRows = await prisma.$queryRaw<UserNameRow[]>(
          Prisma.sql`SELECT id, name, phone FROM "User" WHERE id IN (${Prisma.join(agentIds)})`
        );
        const phones = userRows.map((u) => u.phone).filter((p): p is string => p != null);
        const phoneToDisplayName = new Map<string, string | null>();
        if (phones.length > 0) {
          // REVIEW-007: organizationId 필터 추가 — 동일 전화번호가 여러 조직에 존재할 때
          // 다른 조직의 displayName이 반환되는 PII 간접 노출 방지.
          // GLOBAL_ADMIN은 organizationId 제한 없이 조회 (User.name 폴백 유지).
          const orgMemberWhere: {
            phone: { in: string[] };
            isActive: boolean;
            organizationId?: string;
          } = { phone: { in: phones }, isActive: true };
          if (ctx.role !== 'GLOBAL_ADMIN' && ctx.organizationId != null) {
            orgMemberWhere.organizationId = ctx.organizationId;
          }
          const orgMembers = await prisma.organizationMember.findMany({
            where: orgMemberWhere,
            select: { phone: true, displayName: true },
          });
          for (const om of orgMembers) {
            if (om.phone) phoneToDisplayName.set(om.phone, om.displayName);
          }
        }
        for (const u of userRows) {
          const displayName = (u.phone ? phoneToDisplayName.get(u.phone) : undefined) ?? u.name;
          if (displayName) agentNameMap.set(u.id, displayName);
        }
      } catch {
        // agentName 조회 실패 시 무시 (User 테이블 없을 수 있음)
      }
    }

    return NextResponse.json({
      ok: true,
      goldMembers: members.map((m) => ({
        id:             m.id,
        name:           m.name,
        phone:          maskPhone(m.phone),
        email:          m.email,
        memberCode:     m.memberCode,
        courseType:     m.courseType,
        joinDate:       m.joinDate?.toISOString() ?? null,
        paymentDay:     m.paymentDay,
        totalPayments:  m.totalPayments,
        paidCount:      m.paidCount,
        status:         m.status,
        memo:           m.memo,
        agentId:        m.agentId ?? null,
        agentName:      m.agentId != null ? (agentNameMap.get(m.agentId) ?? null) : null,
        consultationCount: m._count?.consultations ?? 0,
        createdAt:      m.createdAt?.toISOString() ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[GET /api/gold-members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

// POST: 골드회원 등록
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json() as {
      name: string;
      phone: string;
      email?: string;
      courseType: string;
      joinDate: string;
      paymentDay?: number;
      totalPayments?: number;
      memo?: string;
      agentId?: string | number;
    };

    const { name, phone, email, courseType, joinDate, paymentDay, totalPayments, memo, agentId: agentIdRaw } = body;

    // OWNER가 담당 대리점장 지정 시 agentId 처리
    let agentIdNum: number | undefined;
    if (agentIdRaw !== undefined && agentIdRaw !== null && agentIdRaw !== '') {
      const parsed = parseInt(String(agentIdRaw), 10);
      if (!isNaN(parsed)) agentIdNum = parsed;
    }
    if (!name || !phone || !courseType || !joinDate) {
      return NextResponse.json({ ok: false, error: '이름, 전화번호, 코스, 가입날짜는 필수입니다.' }, { status: 400 });
    }
    if (!['A', 'B', 'C', 'HEALTH'].includes(courseType)) {
      return NextResponse.json({ ok: false, error: '코스는 A, B, C, 건강 중 하나여야 합니다.' }, { status: 400 });
    }
    if (paymentDay !== undefined && (paymentDay < 1 || paymentDay > 31 || !Number.isInteger(paymentDay))) {
      return NextResponse.json({ ok: false, error: '납부일은 1-31 사이 정수여야 합니다.' }, { status: 400 });
    }
    if (totalPayments !== undefined && (totalPayments < 0 || !Number.isInteger(totalPayments))) {
      return NextResponse.json({ ok: false, error: '의무납입 횟수는 0 이상 정수여야 합니다.' }, { status: 400 });
    }
    const joinDateObj = new Date(joinDate);
    if (isNaN(joinDateObj.getTime())) {
      return NextResponse.json({ ok: false, error: '올바른 날짜 형식이 아닙니다.' }, { status: 400 });
    }

    if (ctx.role === 'OWNER' && !ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
    }
    const organizationId = ctx.organizationId ?? (ctx.role === 'GLOBAL_ADMIN' ? (await prisma.organization.findFirst({ select: { id: true } }))?.id : undefined);
    if (!organizationId) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 500 });

    // 고유 memberCode 생성
    let memberCode = '';
    for (let i = 0; i < 10; i++) {
      const code = generateMemberCode();
      const exists = await prisma.goldMember.findUnique({ where: { memberCode: code } });
      if (!exists) { memberCode = code; break; }
    }
    if (!memberCode) return NextResponse.json({ ok: false, error: '코드 생성 실패' }, { status: 500 });

    // ABC코스: 의무납입 60회 기본, 건강코스: 의무납입 없음(0)
    const defaultTotal = courseType === 'HEALTH' ? 0 : 60;

    const member = await prisma.goldMember.create({
      data: {
        organizationId,
        name,
        phone: phone.replace(/[^0-9]/g, ''),
        email: email || null,
        memberCode,
        courseType,
        joinDate: joinDateObj,
        paymentDay: paymentDay ?? null,
        totalPayments: courseType === 'HEALTH' ? 0 : (totalPayments ?? defaultTotal),
        paidCount: 0,
        memo: memo || null,
        ...(agentIdNum !== undefined ? { agentId: agentIdNum } : {}),
      },
    });

    logger.info('[POST /api/gold-members] 골드회원 등록', { id: member.id, courseType });
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    logger.error('[POST /api/gold-members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
