export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

function generateMemberCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * POST /api/gold-inquiries/[id]/convert
 * 골드문의 → 골드회원 전환
 * 권한: OWNER, GLOBAL_ADMIN
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;
    const inquiryId = parseInt(id, 10);
    if (isNaN(inquiryId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const body = await req.json() as { courseType?: string; joinDate?: string };
    const courseType = body.courseType ?? 'A';
    if (!['A', 'B', 'C'].includes(courseType)) {
      return NextResponse.json({ ok: false, error: '코스는 A, B, C 중 하나여야 합니다.' }, { status: 400 });
    }

    // ProductInquiry 원본 데이터 조회 (GMcruise 공유 DB)
    const inquiries = await prisma.$queryRaw<Array<{ name: string; phone: string; message: string | null }>>(
      Prisma.sql`
        SELECT name, phone, message
        FROM "ProductInquiry"
        WHERE id = ${inquiryId} AND "productCode" = 'GOLD_MEMBERSHIP'
        LIMIT 1
      `
    );
    if (!inquiries[0]) {
      return NextResponse.json({ ok: false, error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }
    const inquiry = inquiries[0];

    // 조직 ID 결정
    const organizationId = ctx.organizationId
      ?? (await prisma.organization.findFirst({ select: { id: true } }))?.id;
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 500 });
    }

    // 전화번호 정규화
    const rawPhone = inquiry.phone.replace(/\D/g, '');

    // 이미 전환된 회원 중복 체크 (같은 조직 + 전화번호)
    const existing = await prisma.goldMember.findFirst({
      where: { organizationId, phone: rawPhone },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, memberId: existing.id, alreadyExists: true });
    }

    // 고유 memberCode 생성
    let memberCode = '';
    for (let i = 0; i < 10; i++) {
      const code = generateMemberCode();
      const exists = await prisma.goldMember.findUnique({ where: { memberCode: code } });
      if (!exists) { memberCode = code; break; }
    }
    if (!memberCode) return NextResponse.json({ ok: false, error: '코드 생성 실패' }, { status: 500 });

    // GoldMember 생성
    const joinDate = body.joinDate ? new Date(body.joinDate) : new Date();
    const member = await prisma.goldMember.create({
      data: {
        organizationId,
        name: inquiry.name,
        phone: rawPhone,
        memberCode,
        courseType,
        joinDate,
        paidCount: 0,
        totalPayments: 0,
        memo: inquiry.message ? `[골드문의 전환] ${inquiry.message}` : '[골드문의 전환]',
      },
      select: { id: true },
    });

    logger.log('[POST /api/gold-inquiries/[id]/convert]', {
      inquiryId,
      memberId: member.id,
      courseType,
      role: ctx.role,
    });

    return NextResponse.json({ ok: true, memberId: member.id, alreadyExists: false });
  } catch (err) {
    logger.error('[POST /api/gold-inquiries/[id]/convert]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
