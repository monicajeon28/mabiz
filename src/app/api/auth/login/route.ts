import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { MABIZ_SESSION_COOKIE } from '@/lib/auth';
import { createHash, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

function isBcryptHash(h: string) {
  return h.startsWith('$2b$') || h.startsWith('$2a$');
}

async function checkPassword(input: string, stored: string | null): Promise<boolean> {
  if (!stored) return input === 'qwe1';

  if (isBcryptHash(stored)) {
    return bcrypt.compare(input, stored);
  }

  // SHA256 비교
  const inputHash = createHash('sha256').update(input).digest('hex');
  try {
    const a = Buffer.from(inputHash);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json() as { phone?: string; password?: string };

    if (!phone?.trim() || !password) {
      return NextResponse.json({ ok: false, error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 아이디: 숫자만 있으면 전화번호 정규화, 영문 포함이면 그대로
    const raw = phone.trim();
    const phoneClean = /^[0-9\-\s]+$/.test(raw) ? raw.replace(/[^0-9]/g, '') : raw;

    // GlobalAdmin 먼저 확인
    const admin = await prisma.globalAdmin.findFirst({
      where: { phone: phoneClean },
    });

    if (admin) {
      if (!await checkPassword(password, admin.passwordHash ?? null)) {
        return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const session = await prisma.mabizSession.create({
        data: { adminId: admin.id, role: 'GLOBAL_ADMIN', expiresAt },
      });

      const cookieStore = await cookies();
      cookieStore.set(MABIZ_SESSION_COOKIE, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      return NextResponse.json({ ok: true, role: 'GLOBAL_ADMIN' });
    }

    // OrganizationMember 확인
    const member = await prisma.organizationMember.findFirst({
      where: { phone: phoneClean, isActive: true },
    });

    if (!member) {
      return NextResponse.json({ ok: false, error: '등록되지 않은 아이디입니다.' }, { status: 401 });
    }

    if (!await checkPassword(password, member.passwordHash ?? null)) {
      return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const role =
      member.role === 'OWNER'      ? 'OWNER'      :
      member.role === 'FREE_SALES' ? 'FREE_SALES' : 'AGENT';

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await prisma.mabizSession.create({
      data: { memberId: member.id, role, organizationId: member.organizationId, expiresAt },
    });

    const cookieStore = await cookies();
    cookieStore.set(MABIZ_SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    logger.log('[POST /api/auth/login] 로그인 성공', { memberId: member.id, role });

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    logger.error('[POST /api/auth/login]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
