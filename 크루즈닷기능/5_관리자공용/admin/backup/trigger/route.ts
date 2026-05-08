export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { manualRunDatabaseBackup } from '@/lib/scheduler/databaseBackup';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 데이터베이스 백업 수동 트리거 API
 * POST /api/admin/backup/trigger
 * 
 * 관리자만 백업을 수동으로 실행할 수 있습니다.
 */
export async function POST(req: Request) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    console.log('[Backup Trigger] Manual backup requested by admin:', session.User.id);
    
    // 백업 실행
    const result = await manualRunDatabaseBackup();

    return NextResponse.json({
      ok: true,
      message: '데이터베이스 백업이 완료되었습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('[Backup Trigger] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '백업 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
