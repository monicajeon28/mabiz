export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import { logger } from '@/lib/logger';

async function checkAdminAuth(sid: string | undefined): Promise<{ isAdmin: boolean; userId?: number; error?: string }> {
  if (!sid) {
    return { isAdmin: false, error: '세션이 없습니다.' };
  }
  
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {
      return { isAdmin: false, error: '세션을 찾을 수 없습니다.' };
    }

    const isAdmin = session.User.role === 'admin';
    return { isAdmin, userId: session.User.id };
  } catch (error: any) {
    logger.error('[Admin Users] Auth check error:', error);
    return { isAdmin: false, error: '인증 확인 중 오류가 발생했습니다.' };
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const authResult = await checkAdminAuth(sid);
    if (!authResult.isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: authResult.error || '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    const where: any = {};
    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    logger.error('[Admin Users] Error:', error);
    return NextResponse.json({
      ok: false,
      error: '사용자 목록을 불러오는데 실패했습니다.',
    }, { status: 500 });
  }
}
