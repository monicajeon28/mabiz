export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  return phone.slice(0, 3) + '****' + phone.slice(-4);
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

    const where: Record<string, unknown> = {};
    if (ctx.organizationId) where.organizationId = ctx.organizationId;
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
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout (5s)')), 5000)
        ) as Promise<any>,
      ]);
      members = m;
      total = t;
    } catch (err) {
      if (err instanceof Error && err.message.includes('timeout')) {
        logger.warn('[GET /api/gold-members] Query timeout', { page, limit, query: q });
        return NextResponse.json({
          ok: true,
          goldMembers: [],
          total: 0,
          page,
          totalPages: 0,
          warning: '쿼리 타임아웃으로 인해 빈 결과가 반환되었습니다.',
        });
      }
      throw err;
    }

    return NextResponse.json({
      ok: true,
      goldMembers: members.map((m: any) => ({
        id:             m.id,
        name:           m.name,
        phone:          maskPhone(m.phone),
        email:          m.email,
        memberCode:     m.memberCode,
        courseType:     m.courseType,
        joinDate:       m.joinDate.toISOString(),
        paymentDay:     m.paymentDay,
        totalPayments:  m.totalPayments,
        paidCount:      m.paidCount,
        status:         m.status,
        memo:           m.memo,
        consultationCount: m._count.consultations,
        createdAt:      m.createdAt.toISOString(),
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
    };

    const { name, phone, email, courseType, joinDate, paymentDay, totalPayments, memo } = body;
    if (!name || !phone || !courseType || !joinDate) {
      return NextResponse.json({ ok: false, error: '이름, 전화번호, 코스, 가입날짜는 필수입니다.' }, { status: 400 });
    }
    if (!['A', 'B', 'C', 'HEALTH'].includes(courseType)) {
      return NextResponse.json({ ok: false, error: '코스는 A, B, C, 건강 중 하나여야 합니다.' }, { status: 400 });
    }

    const organizationId = ctx.organizationId ?? (await prisma.organization.findFirst({ select: { id: true } }))?.id;
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
        joinDate: new Date(joinDate),
        paymentDay: paymentDay ?? null,
        totalPayments: courseType === 'HEALTH' ? 0 : (totalPayments ?? defaultTotal),
        paidCount: 0,
        memo: memo || null,
      },
    });

    logger.log('[POST /api/gold-members] 골드회원 등록', { id: member.id, courseType });
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    logger.error('[POST /api/gold-members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
