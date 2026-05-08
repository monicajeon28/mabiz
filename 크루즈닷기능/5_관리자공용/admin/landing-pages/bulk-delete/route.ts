export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  try {
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Landing Pages Bulk Delete] Auth check error:', error);
    return false;
  }
}

// DELETE: 랜딩페이지 일괄 삭제
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: '삭제할 랜딩페이지 ID가 필요합니다' }, { status: 400 });
    }

    // 모든 ID가 숫자인지 확인
    const pageIds = ids.map((id: any) => parseInt(String(id))).filter((id: number) => !isNaN(id));
    
    if (pageIds.length === 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다' }, { status: 400 });
    }

    // 일괄 삭제
    const result = await prisma.landingPage.deleteMany({
      where: {
        id: { in: pageIds },
      },
    });

    return NextResponse.json({
      ok: true,
      message: `${result.count}개의 랜딩페이지가 삭제되었습니다.`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages Bulk Delete] Error:', error);
    return NextResponse.json(
      { ok: false, error: '랜딩페이지 일괄 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
