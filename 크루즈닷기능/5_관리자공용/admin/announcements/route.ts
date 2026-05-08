export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

async function checkAdminAuth(sid: string | undefined): Promise<{ isAdmin: boolean; userId: number | null }> {
  try {
    if (!sid) return { isAdmin: false, userId: null };

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) {
      return { isAdmin: false, userId: null };
    }

    return { isAdmin: session.User.role === 'admin', userId: session.User.id };
  } catch (error) {
    console.error('[Announcements API] Auth check error:', error);
    return { isAdmin: false, userId: null };
  }
}

// POST: 공지사항 발송 (전체 관리자/대리점장/판매원 대상)
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);
    
    if (!auth.isAdmin || !auth.userId) {
      return NextResponse.json(
        { ok: false, error: '본사 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, content, targetType, priority } = body;

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 대상자 조회
    let targetUserIds: number[] = [];

    if (targetType === 'all') {
      // 전체: 관리자 + 대리점장 + 판매원
      const allUsers = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'admin' },
            { AffiliateProfile: { isNot: null } },
          ],
        },
        select: { id: true },
      });
      targetUserIds = allUsers.map(u => u.id);
    } else if (targetType === 'managers') {
      // 대리점장만
      const managers = await prisma.affiliateProfile.findMany({
        where: { type: 'BRANCH_MANAGER', status: 'ACTIVE' },
        select: { userId: true },
      });
      targetUserIds = managers.map(m => m.userId);
    } else if (targetType === 'agents') {
      // 판매원만
      const agents = await prisma.affiliateProfile.findMany({
        where: { type: 'SALES_AGENT', status: 'ACTIVE' },
        select: { userId: true },
      });
      targetUserIds = agents.map(a => a.userId);
    }

    // 알림 생성
    if (targetUserIds.length > 0) {
      await prisma.adminNotification.createMany({
        data: targetUserIds.map(userId => ({
          userId,
          notificationType: 'announcement',
          title,
          content,
          priority: priority || 'normal',
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      message: `공지사항이 ${targetUserIds.length}명에게 발송되었습니다.`,
      sentCount: targetUserIds.length,
    });
  } catch (error: any) {
    console.error('[Announcements API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '공지사항 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
