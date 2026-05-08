export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

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

// 일괄 삭제 API (POST 메서드 사용)
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

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: '삭제할 관리자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 관리자 ID들을 숫자로 변환
    const adminIds = ids.map((id: any) => parseInt(String(id))).filter((id: number) => !isNaN(id) && id > 0);

    if (adminIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '유효한 관리자 ID가 없습니다.' },
        { status: 400 }
      );
    }

    console.log('[Admin Panel Admins API] Batch delete request:', { adminIds });

    // 삭제할 관리자들 확인 (크루즈몰 관리자 제외)
    const adminsToDelete = await prisma.user.findMany({
      where: {
        id: { in: adminIds },
        role: 'admin',
        // 크루즈몰 관리자 제외
        NOT: {
          phone: {
            in: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'],
          },
        },
        OR: [
          { customerSource: 'admin' },
          { customerSource: null }, // 기존 관리자 (customerSource가 없는 경우)
        ],
      },
      select: { id: true, phone: true, customerSource: true },
    });

    console.log('[Admin Panel Admins API] Admins to delete found:', adminsToDelete.length);

    // 크루즈몰 관리자가 포함되어 있는지 확인
    const mallAdmins = adminsToDelete.filter(
      admin => admin.customerSource === 'mall-admin' || 
      (admin.phone && ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'].includes(admin.phone))
    );

    if (mallAdmins.length > 0) {
      return NextResponse.json(
        { ok: false, error: '크루즈몰 관리자는 관리자 패널 관리에서 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    if (adminsToDelete.length === 0) {
      return NextResponse.json(
        { ok: false, error: '삭제할 관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 관리자 계정 일괄 삭제
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: adminsToDelete.map(a => a.id) },
      },
    });

    console.log('[Admin Panel Admins API] Batch delete success:', { deletedCount: deleteResult.count });

    return NextResponse.json({ 
      ok: true, 
      message: `${deleteResult.count}명의 관리자가 삭제되었습니다.`,
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    console.error('[Admin Panel Admins API] Batch delete error:', error);
    console.error('[Admin Panel Admins API] Batch delete error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}
