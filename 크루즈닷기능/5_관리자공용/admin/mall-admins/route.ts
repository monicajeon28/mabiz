export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// PII 마스킹 함수
function maskName(name: string): string {
  if (!name || name.length < 2) return '***';
  return name.charAt(0) + '*'.repeat(Math.max(1, name.length - 2)) + name.charAt(name.length - 1);
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***';
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin' || false;
  } catch (error) {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다.',
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 크루즈몰 관리자 조회 (role이 'admin'이고 phone이 user1~user10인 경우)
    const MALL_ADMIN_PHONES = ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'] as const;
    const where: Prisma.UserWhereInput = {
      role: 'admin',
      phone: {
        in: [...MALL_ADMIN_PHONES],
      },
      ...(search ? {
        AND: [
          {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
            ],
          },
        ],
      } : {}),
    };

    const total = await prisma.user.count({ where });

    const mallAdmins = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        loginCount: true,
        isLocked: true,
        isHibernated: true,
        adminMemo: true, // 기능 설정 저장용
        mallNickname: true, // 닉네임 저장용
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    logger.log('[Admin Mall Admins GET] 관리자 목록 조회:', {
      total,
      page,
      limit,
      searchUsed: !!search,
    });

    return NextResponse.json({
      ok: true,
      admins: mallAdmins.map(admin => {
        // P0: 비밀번호 필드 제거 (평문 또는 해시된 상태로 API에 노출하면 안 됨)
        return {
          id: admin.id,
          name: admin.name,
          phone: admin.phone,
          email: admin.email,
          loginCount: admin.loginCount,
          isLocked: admin.isLocked,
          isHibernated: admin.isHibernated,
          adminMemo: admin.adminMemo,
          mallNickname: admin.mallNickname,
          createdAt: admin.createdAt.toISOString(),
          lastActiveAt: admin.lastActiveAt?.toISOString() || null,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[Admin Mall Admins API] 조회 오류:', {
      message: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다.',
      }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, email, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { ok: false, error: '전화번호(user1~user10)와 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 입력 검증
    if (typeof password !== 'string' || password.length < 4 || password.length > 100) {
      return NextResponse.json({ ok: false, error: '비밀번호는 4-100자여야 합니다.' }, { status: 400 });
    }
    if (name !== undefined && name !== null && (typeof name !== 'string' || name.length > 100)) {
      return NextResponse.json({ ok: false, error: '이름은 최대 100자입니다.' }, { status: 400 });
    }
    if (email !== undefined && email !== null && (typeof email !== 'string' || email.length > 254)) {
      return NextResponse.json({ ok: false, error: '이메일은 최대 254자입니다.' }, { status: 400 });
    }

    // phone이 user1~user10 형식인지 확인
    if (!/^user(1[0]|[1-9])$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: '전화번호는 user1~user10 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existing = await prisma.user.findFirst({
      where: {
        phone,
        role: 'admin',
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: '이미 존재하는 관리자입니다.' },
        { status: 400 }
      );
    }

    // 관리자 생성
    const admin = await prisma.user.create({
      data: {
        name: name || phone,
        phone,
        email: email || null,
        password,
        role: 'admin',
        onboarded: true,
        loginCount: 0,
        customerSource: 'mall-admin', // 크루즈몰 관리자
      },
    });

    logger.log('[Admin Mall Admins POST] 관리자 생성 성공:', {
      adminId: admin.id,
      phoneHash: maskPhone(admin.phone),
      nameHash: admin.name ? maskName(admin.name) : 'unnamed',
    });

    return NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        phone: admin.phone,
        email: admin.email,
        loginCount: admin.loginCount,
        isLocked: admin.isLocked,
        isHibernated: admin.isHibernated,
        adminMemo: admin.adminMemo,
        mallNickname: admin.mallNickname,
        createdAt: admin.createdAt.toISOString(),
        lastActiveAt: admin.lastActiveAt?.toISOString() || null,
      },
    });
  } catch (error) {
    logger.error('[Admin Mall Admins API] 생성 오류:', {
      message: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
