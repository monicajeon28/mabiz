export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import prisma from '@/lib/prisma';

async function checkAdminAuth(sid: string | undefined): Promise<{ id: number; name: string | null } | null> {
  if (!sid) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) return null;
    if (session.User.role !== 'admin') return null;
    return { id: session.User.id, name: session.User.name };
  } catch (error) {
    console.error('[Team Dashboard Message] Auth check error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const admin = await checkAdminAuth(sid);
    if (!admin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { userIds, title, content } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '수신자 목록이 필요합니다.',
      }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({
        ok: false,
        error: '제목과 내용을 입력해주세요.',
      }, { status: 400 });
    }

    // 각 사용자에게 팀 대시보드 메시지 생성
    let sentCount = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        // 사용자가 존재하는지 확인
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId.toString()) },
        });

        if (!user) {
          errors.push(`사용자 ID ${userId}를 찾을 수 없습니다.`);
          continue;
        }

        // AdminMessage 생성 (팀 대시보드 메시지)
        await prisma.adminMessage.create({
          data: {
            adminId: admin.id,
            userId: user.id,
            title,
            content,
            messageType: 'team-dashboard',
            isActive: true,
            totalSent: 1,
            metadata: {
              type: 'team-dashboard',
              sentAt: new Date().toISOString(),
            },
          },
        });

        sentCount++;
      } catch (error: any) {
        errors.push(`사용자 ID ${userId}: ${error.message || '메시지 생성 실패'}`);
        console.error(`[Team Dashboard Message] Failed to send to user ${userId}:`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount: errors.length,
      totalCount: userIds.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('[Team Dashboard Message] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '팀 대시보드 메시지 발송에 실패했습니다.',
    }, { status: 500 });
  }
}
