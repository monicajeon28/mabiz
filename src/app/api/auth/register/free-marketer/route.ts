import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { MABIZ_SESSION_COOKIE } from '@/lib/auth';
import { createHash } from 'crypto';

const BONSA_ORG_ID = 'org_bonsa_cruisedot';

export async function POST(req: Request) {
  try {
    const { name, phone, password } = await req.json() as { name?: string; phone?: string; password?: string };

    if (!name?.trim() || !phone?.trim() || !password) {
      return NextResponse.json({ ok: false, error: '이름, 전화번호, 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const phoneClean = phone.trim().replace(/[^0-9]/g, '');
    if (phoneClean.length < 10) {
      return NextResponse.json({ ok: false, error: '올바른 전화번호를 입력해주세요.' }, { status: 400 });
    }

    // 중복 가입 확인
    const existing = await prisma.organizationMember.findFirst({
      where: { phone: phoneClean },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: '이미 등록된 전화번호입니다.' }, { status: 400 });
    }

    const passwordHash = createHash('sha256').update(password).digest('hex');
    const memberId = `mbr_fm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await prisma.organizationMember.create({
      data: {
        id: memberId,
        organizationId: BONSA_ORG_ID,
        userId: memberId,
        phone: phoneClean,
        passwordHash,
        role: 'FREE_SALES',
        displayName: name.trim(),
        isActive: true,
      },
    });

    // 자동 로그인 세션
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await prisma.mabizSession.create({
      data: {
        memberId,
        role: 'FREE_SALES',
        organizationId: BONSA_ORG_ID,
        expiresAt,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(MABIZ_SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    logger.log('[POST /api/auth/register/free-marketer] 프리마케터 가입', {
      memberId,
      phone: phoneClean.substring(0, 4) + '***',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /api/auth/register/free-marketer]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
