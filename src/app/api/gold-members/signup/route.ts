export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

function generateMemberCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// POST: 고객 신청 (로그인 불필요)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string;
      phone: string;
      email: string;
      courseType: string;
      joinDate: string;
      paymentDay: number;
      paymentMethod: string;
      totalPayments: number;
    };

    // 입력값 검증
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { ok: false, error: '이름은 필수입니다.' },
        { status: 400 }
      );
    }

    const phoneDigits = body.phone.replace(/[^0-9]/g, '');
    if (!phoneDigits.match(/^01[0-9]\d{7,8}$/)) {
      return NextResponse.json(
        { ok: false, error: '올바른 휴대폰 번호가 아닙니다.' },
        { status: 400 }
      );
    }

    if (!body.email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: '올바른 이메일이 아닙니다.' },
        { status: 400 }
      );
    }

    if (!['A', 'B'].includes(body.courseType)) {
      return NextResponse.json(
        { ok: false, error: '올바른 플랜 타입이 아닙니다.' },
        { status: 400 }
      );
    }

    if (!['card', 'account'].includes(body.paymentMethod)) {
      return NextResponse.json(
        { ok: false, error: '올바른 결제 방법이 아닙니다.' },
        { status: 400 }
      );
    }

    if (body.paymentDay < 1 || body.paymentDay > 28) {
      return NextResponse.json(
        { ok: false, error: '결제일은 1-28 사이여야 합니다.' },
        { status: 400 }
      );
    }

    if (body.totalPayments < 1 || body.totalPayments > 36) {
      return NextResponse.json(
        { ok: false, error: '총 납부 개월 수는 1-36 사이여야 합니다.' },
        { status: 400 }
      );
    }

    // 기존 가입 확인 (이메일 기반)
    const existing = await prisma.goldMember.findFirst({
      where: { email: body.email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: '이미 가입된 이메일입니다. 고객 지원팀에 문의해주세요.' },
        { status: 409 }
      );
    }

    // 조직 구분 (공개 신청 → 환경변수, 로그인 시 세션 우선)
    let organizationId = process.env.DEFAULT_ORGANIZATION_ID ?? '';
    if (!organizationId) {
      return NextResponse.json({ ok: false, message: '서비스 설정 오류입니다.' }, { status: 500 });
    }
    try {
      const ctx = await getMabizSession();
      if (ctx?.organizationId) organizationId = ctx.organizationId;
    } catch {
      // 로그인하지 않은 공개 신청 → 환경변수 값 사용
    }

    // 고유 memberCode 생성 (최대 10회 재시도 — 충돌 방지)
    let memberCode = '';
    for (let i = 0; i < 10; i++) {
      const code = generateMemberCode();
      const exists = await prisma.goldMember.findUnique({ where: { memberCode: code } });
      if (!exists) { memberCode = code; break; }
    }
    if (!memberCode) {
      return NextResponse.json({ ok: false, error: '코드 생성 실패. 다시 시도해주세요.' }, { status: 500 });
    }

    // 골드회원 생성 — memo에 paymentMethod 포함하여 단일 create로 처리
    const goldMember = await prisma.goldMember.create({
      data: {
        name: body.name.trim(),
        phone: phoneDigits,
        email: body.email.toLowerCase(),
        memberCode,
        courseType: body.courseType,
        joinDate: new Date(body.joinDate),
        paymentDay: body.paymentDay,
        totalPayments: body.totalPayments,
        paidCount: 0,
        status: 'PENDING',
        organizationId,
        memo: `결제방법: ${body.paymentMethod === 'card' ? '신용카드' : '계좌이체'}`,
      },
    });

    logger.info('[POST /api/gold-members/signup] 신규 가입', {
      goldMemberId: goldMember.id,
      email: body.email,
      courseType: body.courseType,
    });

    return NextResponse.json({
      ok: true,
      id: goldMember.id,
      memberCode: goldMember.memberCode,
      email: goldMember.email,
      message: '가입이 완료되었습니다. 확인 이메일을 확인해주세요.',
    });
  } catch (err) {
    logger.error('[POST /api/gold-members/signup]', { err });
    return NextResponse.json(
      { ok: false, error: '가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
