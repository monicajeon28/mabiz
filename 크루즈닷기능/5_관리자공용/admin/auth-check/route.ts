export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { validateCsrfToken } from '@/lib/csrf';

const SESSION_COOKIE = 'cg.sid.v2';
const CSRF_COOKIE = 'cg.csrf.v1';

// PII 마스킹 함수
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***';
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

function maskName(name: string): string {
  if (!name || name.length < 2) return '***';
  return name.charAt(0) + '*'.repeat(Math.max(1, name.length - 2)) + name.charAt(name.length - 1);
}

// GET: 관리자 인증 상태 확인
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ ok: false, authenticated: false });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {  // ✅ 대문자 U로 변경
      return NextResponse.json({ ok: false, authenticated: false });
    }

    // 관리자 패널 접근 권한: 01024958013, 01038609161 또는 대리점장 허용, user1~user10은 차단
    const user = await prisma.user.findUnique({
      where: { id: session.User.id },
      select: {
        role: true,
        phone: true,
        AffiliateProfile: {
          select: { type: true }
        }
      }
    });

    // 전화번호 정규화 (로그인 시와 동일하게 처리)
    const normalizedPhone = user?.phone?.replace(/[-\s]/g, '') || '';

    // user1~user10은 관리자 패널 접근 불가
    if (normalizedPhone && /^user(1[0]|[1-9])$/.test(normalizedPhone)) {
      logger.warn('[Admin Auth Check] user1~user10 차단:', {
        phoneHash: maskPhone(normalizedPhone)
      });
      return NextResponse.json({
        ok: false,
        authenticated: false,
        error: 'user1~user10은 관리자 패널에 접근할 수 없습니다.'
      });
    }

    // 대리점장인지 확인
    const isBranchManager = user?.AffiliateProfile?.type === 'BRANCH_MANAGER';

    // 01024958013 또는 01038609161 또는 대리점장(BRANCH_MANAGER)만 접근 허용
    const isSuperAdmin = normalizedPhone === '01024958013' || normalizedPhone === '01038609161';
    const isAuthorized = isSuperAdmin || isBranchManager;

    logger.log('[Admin Auth Check] 권한 확인:', {
      phoneHash: maskPhone(normalizedPhone),
      nameHash: session.User.name ? maskName(session.User.name) : 'unnamed',
      isAuthorized,
      isSuperAdmin,
      isBranchManager,
    });

    if (!isAuthorized) {
      logger.warn('[Admin Auth Check] 접근 권한 없음:', {
        userId: session.User.id,
        role: user?.role,
        nameHash: session.User.name ? maskName(session.User.name) : 'unnamed',
      });
      return NextResponse.json({ ok: false, authenticated: false });
    }

    return NextResponse.json({
      ok: true,
      authenticated: isAuthorized,
      user: {
        id: session.User.id,
        name: session.User.name,
        role: session.User.role,
        phone: user?.phone,
        isBranchManager,
        isSuperAdmin
      },
    });
  } catch (error) {
    logger.error('[Admin Auth Check] Error:', {
      message: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : '인증 확인 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 관리자 인증 상태 확인 (상태 변경 작업용, CSRF 보호 필수)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // CSRF 토큰 검증 (POST 요청에는 필수)
    const sessionCsrfToken = cookieStore.get(CSRF_COOKIE)?.value;
    const headerCsrfToken = request.headers.get('x-csrf-token');

    if (!validateCsrfToken(sessionCsrfToken, headerCsrfToken)) {
      logger.warn('[Admin Auth Check POST] CSRF 검증 실패:', {
        hasCookie: !!sessionCsrfToken,
        hasHeader: !!headerCsrfToken,
      });
      return NextResponse.json(
        { ok: false, error: '요청이 유효하지 않습니다.' },
        { status: 403 }
      );
    }

    // GET과 동일한 인증 로직
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json({ ok: false, authenticated: false });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {
      return NextResponse.json({ ok: false, authenticated: false });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.User.id },
      select: {
        role: true,
        phone: true,
        AffiliateProfile: {
          select: { type: true }
        }
      }
    });

    const normalizedPhone = user?.phone?.replace(/[-\s]/g, '') || '';

    if (normalizedPhone && /^user(1[0]|[1-9])$/.test(normalizedPhone)) {
      logger.warn('[Admin Auth Check POST] user1~user10 차단:', {
        phoneHash: maskPhone(normalizedPhone)
      });
      return NextResponse.json({
        ok: false,
        authenticated: false,
        error: 'user1~user10은 관리자 패널에 접근할 수 없습니다.'
      });
    }

    const isBranchManager = user?.AffiliateProfile?.type === 'BRANCH_MANAGER';
    const isSuperAdmin = normalizedPhone === '01024958013' || normalizedPhone === '01038609161';
    const isAuthorized = isSuperAdmin || isBranchManager;

    logger.log('[Admin Auth Check POST] 권한 확인:', {
      phoneHash: maskPhone(normalizedPhone),
      nameHash: session.User.name ? maskName(session.User.name) : 'unnamed',
      isAuthorized,
      isSuperAdmin,
      isBranchManager,
    });

    if (!isAuthorized) {
      logger.warn('[Admin Auth Check POST] 접근 권한 없음:', {
        userId: session.User.id,
        role: user?.role,
        nameHash: session.User.name ? maskName(session.User.name) : 'unnamed',
      });
      return NextResponse.json({ ok: false, authenticated: false });
    }

    return NextResponse.json({
      ok: true,
      authenticated: isAuthorized,
      user: {
        id: session.User.id,
        name: session.User.name,
        role: session.User.role,
        phone: user?.phone,
        isBranchManager,
        isSuperAdmin
      },
    });
  } catch (error) {
    logger.error('[Admin Auth Check POST] Error:', {
      message: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : '인증 확인 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
