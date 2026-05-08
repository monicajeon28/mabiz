export const dynamic = 'force-dynamic';

// app/api/admin/customers/create-mall/route.ts
// 크루즈몰 회원 추가 API (메인몰 고객 관리용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { role: true } } },
    });
    return session?.User?.role === 'admin' || false;
  } catch (error) {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const { username, password, nickname, email } = await req.json();

    // 필수 필드 검증
    if (!username || !password || !nickname || !email) {
      return NextResponse.json(
        { ok: false, error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 아이디 길이 검증
    if (username.length < 4) {
      return NextResponse.json(
        { ok: false, error: '아이디는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: '비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 아이디 중복 확인 (mallUserId 필드로 확인)
    const existingUserByMallUserId = await prisma.user.findFirst({
      where: {
        OR: [
          { mallUserId: username },
          { phone: username } // 레거시 데이터 호환
        ]
      }
    });

    if (existingUserByMallUserId) {
      return NextResponse.json(
        { ok: false, error: '이미 사용 중인 아이디입니다.' },
        { status: 409 }
      );
    }

    // 닉네임 중복 확인 (name 필드에 nickname 저장)
    const existingUserByName = await prisma.user.findFirst({
      where: { name: nickname }
    });

    if (existingUserByName) {
      return NextResponse.json(
        { ok: false, error: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      );
    }

    // 이메일 중복 확인
    const existingUserByEmail = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { ok: false, error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 크루즈몰 사용자 생성 (role을 'community'로 설정, mallUserId와 mallNickname 설정)
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        phone: username, // username을 phone 필드에 저장
        password: hashedPassword,
        name: nickname, // nickname을 name 필드에 저장
        email: email,
        mallUserId: username, // 크루즈몰 사용자 ID
        mallNickname: nickname, // 크루즈몰 닉네임
        onboarded: false,
        role: 'community', // 커뮤니티 전용 사용자
        updatedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      message: '크루즈몰 회원가입이 완료되었습니다.',
      user: {
        id: user.id,
        username: user.phone,
        nickname: user.name,
        email: user.email,
        mallUserId: user.mallUserId,
        mallNickname: user.mallNickname,
      },
    });
  } catch (error: any) {
    console.error('[Admin Create Mall Customer] Error:', error);
    
    // Prisma 오류 처리
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || '필드';
      return NextResponse.json(
        { ok: false, error: `이미 사용 중인 ${field}입니다.` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: '크루즈몰 회원 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
