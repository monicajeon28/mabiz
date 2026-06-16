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

    // 필수 필드 존재 확인 (undefined/null 방지)
    if (!body.name || typeof body.name !== 'string' ||
        !body.phone || typeof body.phone !== 'string' ||
        !body.email || typeof body.email !== 'string' ||
        !body.courseType || !body.joinDate) {
      return NextResponse.json(
        { ok: false, error: '이름, 전화번호, 이메일, 코스, 가입날짜는 필수입니다.' },
        { status: 400 }
      );
    }

    // 입력값 검증
    if (!body.name.trim()) {
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

    const joinDateObj = new Date(body.joinDate);
    if (isNaN(joinDateObj.getTime())) {
      return NextResponse.json({ ok: false, error: '올바른 날짜 형식이 아닙니다.' }, { status: 400 });
    }

    // 기존 가입 확인 (이메일 기반 — 소프트삭제 제외)
    const existing = await prisma.goldMember.findFirst({
      where: { email: body.email.toLowerCase(), deletedAt: null },
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
      return NextResponse.json({ ok: false, error: '서비스 설정 오류입니다.' }, { status: 500 });
    }
    try {
      const ctx = await getMabizSession();
      if (ctx?.organizationId) organizationId = ctx.organizationId;
    } catch {
      // 로그인하지 않은 공개 신청 → 환경변수 값 사용
    }

    // 골드회원 생성
    // NOTE: paymentMethod는 별도 테이블이나 메타데이터로 저장 필요 (현재: 후속 개발)
    const goldMember = await prisma.goldMember.create({
      data: {
        name: body.name.trim(),
        phone: phoneDigits,
        email: body.email.toLowerCase(),
        memberCode: generateMemberCode(),
        courseType: body.courseType,
        joinDate: joinDateObj,
        paymentDay: body.paymentDay,
        totalPayments: body.totalPayments,
        paidCount: 0,
        status: 'PENDING', // 결제 대기 상태
        organizationId,
      },
    });

    // paymentMethod를 memo에 기록 (임시)
    await prisma.goldMember.update({
      where: { id: goldMember.id },
      data: {
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
