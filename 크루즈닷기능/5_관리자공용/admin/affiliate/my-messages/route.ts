export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자/판매원/대리점장 권한 확인 및 사용자 정보 반환
async function checkAuth() {
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

    // admin, manager, agent 모두 허용
    if (!['admin', 'manager', 'agent'].includes(session.User.role)) {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[My Messages] Auth check error:', error);
    return null;
  }
}

// GET: 현재 로그인한 사용자의 팀 대시보드 메시지 조회
export async function GET(req: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const sentOnly = searchParams.get('sentOnly') === 'true'; // 보낸 메시지만

    // 판매원/대리점장이 받거나 보낸 메시지 타입 목록
    const messageTypes = [
      'team-dashboard', // 관리자가 보낸 팀 대시보드 메시지
      'agent-manager', // 판매원 -> 대리점장
      'manager-agent', // 대리점장 -> 판매원
      'manager-manager', // 대리점장 -> 대리점장
      'agent-admin', // 판매원 -> 관리자
      'manager-admin', // 대리점장 -> 관리자
    ];

    // 전체 메시지 조회 (unreadCount 계산용) - 받은 메시지만
    const allReceivedMessagesWhere: any = {
      messageType: { in: messageTypes },
      userId: user.id, // 받은 메시지
      isActive: true,
    };

    const allReceivedMessages = await prisma.adminMessage.findMany({
      where: allReceivedMessagesWhere,
      include: {
        UserMessageRead: {
          where: { userId: user.id },
          select: { readAt: true },
        },
      },
    });

    // 미읽음 개수 계산 (받은 메시지만)
    const unreadCount = allReceivedMessages.filter(msg => msg.UserMessageRead.length === 0).length;

    // 필터링된 메시지 조회
    let where: any;

    if (sentOnly) {
      // 보낸 메시지만
      where = {
        messageType: { in: messageTypes },
        adminId: user.id, // 보낸 메시지
        isActive: true,
      };
    } else {
      // 받은 메시지
      where = {
        messageType: { in: messageTypes },
        userId: user.id,
        isActive: true,
      };

      if (unreadOnly) {
        // 미읽음 메시지만
        where.NOT = {
          UserMessageRead: {
            some: {
              userId: user.id,
            },
          },
        };
      }
    }

    const messages = await prisma.adminMessage.findMany({
      where,
      include: {
        User_AdminMessage_adminIdToUser: {
          select: { id: true, name: true },
        },
        User_AdminMessage_userIdToUser: {
          select: { id: true, name: true },
        },
        UserMessageRead: {
          where: { userId: user.id },
          select: { readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 프론트엔드에서 사용하기 쉽도록 데이터 변환
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      title: msg.title,
      content: msg.content,
      messageType: msg.messageType,
      createdAt: msg.createdAt.toISOString(),
      sender: msg.User_AdminMessage_adminIdToUser, // 발신자
      recipient: msg.User_AdminMessage_userIdToUser, // 수신자
      // team-dashboard 메시지의 경우 admin 필드도 포함 (하위 호환성)
      admin: msg.messageType === 'team-dashboard' ? msg.User_AdminMessage_adminIdToUser : undefined,
      isRead: msg.UserMessageRead.length > 0,
      readAt: msg.UserMessageRead[0]?.readAt?.toISOString() || null,
      isSent: msg.adminId === user.id, // 내가 보낸 메시지인지
    }));

    return NextResponse.json({ 
      ok: true, 
      messages: formattedMessages,
      unreadCount,
      totalCount: formattedMessages.length,
    });
  } catch (error) {
    console.error('[My Messages GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST: 메시지 읽음 처리
export async function POST(req: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json(
        { ok: false, error: '메시지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 이미 읽었는지 확인
    const existingRead = await prisma.userMessageRead.findFirst({
      where: {
        messageId: parseInt(messageId),
        userId: user.id,
      },
    });

    if (existingRead) {
      return NextResponse.json({ ok: true, message: '이미 읽은 메시지입니다.' });
    }

    // 읽음 처리
    await prisma.userMessageRead.create({
      data: {
        messageId: parseInt(messageId),
        userId: user.id,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, message: '메시지를 읽음 처리했습니다.' });
  } catch (error) {
    console.error('[My Messages POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to mark as read' },
      { status: 500 }
    );
  }
}

