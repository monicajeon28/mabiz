export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
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
      return null;
    }

    if (session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin Messages Readers] Auth check error:', error);
    return null;
  }
}

// GET: 특정 메시지의 읽음 상태 상세 정보 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const messageId = parseInt(params.id);

    // 메시지 정보 조회
    const message = await prisma.adminMessage.findUnique({
      where: { id: messageId },
      select: { 
        id: true,
        title: true, 
        content: true, 
        messageType: true, 
        adminId: true, 
        createdAt: true 
      },
    });

    if (!message) {
      return NextResponse.json(
        { ok: false, error: '메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 같은 그룹의 모든 메시지 찾기 (1분 이내, 같은 제목/내용/타입/발신자)
    const groupStartTime = new Date(message.createdAt);
    groupStartTime.setSeconds(0, 0);
    const groupEndTime = new Date(groupStartTime);
    groupEndTime.setMinutes(groupEndTime.getMinutes() + 1);

    const groupMessages = await prisma.adminMessage.findMany({
      where: {
        title: message.title,
        content: message.content,
        messageType: message.messageType,
        adminId: message.adminId,
        isActive: true, // 삭제되지 않은 메시지만
        createdAt: {
          gte: groupStartTime,
          lt: groupEndTime,
        },
      },
      include: {
        User_AdminMessage_userIdToUser: {
          select: { id: true, name: true, phone: true }
        },
        UserMessageRead: {
          include: {
            User_UserMessageRead_userIdToUser: {
              select: { id: true, name: true, phone: true }
            }
          }
        }
      }
    });

    // 읽음/미읽음 상태 정리
    const readers: Array<{
      userId: number;
      name: string | null;
      phone: string | null;
      readAt: string;
      messageId: number;
    }> = [];
    const nonReaders: Array<{
      userId: number;
      name: string | null;
      phone: string | null;
      messageId: number;
    }> = [];

    groupMessages.forEach(msg => {
      const user = msg.User_AdminMessage_userIdToUser;
      if (!user) return;

      const readRecord = msg.UserMessageRead.find(r => r.userId === user.id);
      
      if (readRecord) {
        readers.push({
          userId: user.id,
          name: user.name,
          phone: user.phone,
          readAt: readRecord.readAt.toISOString(),
          messageId: msg.id,
        });
      } else {
        nonReaders.push({
          userId: user.id,
          name: user.name,
          phone: user.phone,
          messageId: msg.id,
        });
      }
    });

    const totalSent = groupMessages.length;
    const totalRead = readers.length;
    const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : '0';

    return NextResponse.json({
      ok: true,
      totalSent,
      totalRead,
      readRate,
      readers,
      nonReaders,
    });
  } catch (error) {
    console.error('[Admin Messages Readers GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch readers' },
      { status: 500 }
    );
  }
}

