export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      logger.log('[Admin Messages] No session cookie found');
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
      logger.log('[Admin Messages] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {
      logger.log('[Admin Messages] User is not admin:', session.User.role);
      return null;
    }

    logger.log('[Admin Messages] Admin authenticated:', session.User.id);
    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    logger.error('[Admin Messages] Auth check error:', error);
    return null;
  }
}

// GET: 메시지 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId'); // 특정 고객의 메시지만 조회
    const messageType = searchParams.get('messageType'); // 메시지 타입 필터
    const dateFrom = searchParams.get('dateFrom'); // 날짜 시작
    const dateTo = searchParams.get('dateTo'); // 날짜 종료
    const adminId = searchParams.get('adminId'); // 발신자 필터
    const readStatus = searchParams.get('readStatus'); // 읽음 상태 필터
    const includeAffiliateMessages = searchParams.get('includeAffiliateMessages') === 'true'; // 판매원/대리점장 메시지 포함

    const where: any = {
      isActive: true, // 삭제되지 않은 메시지만
    };
    
    if (userId) {
      where.userId = parseInt(userId);
    }
    if (messageType) {
      where.messageType = messageType;
    } else if (!includeAffiliateMessages) {
      // 기본적으로는 team-dashboard만, includeAffiliateMessages가 true면 모든 타입
      where.messageType = 'team-dashboard';
    } else {
      // includeAffiliateMessages가 true면 모든 메시지 타입 포함
      // messageType 필터는 적용하지 않음
    }
    if (adminId) {
      where.adminId = parseInt(adminId);
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999); // 해당 날짜의 끝까지 포함
        where.createdAt.lte = endDate;
      }
    }

    const messages = await prisma.adminMessage.findMany({
      where,
      include: {
        User_AdminMessage_adminIdToUser: {
          select: { id: true, name: true },
        },
        User_AdminMessage_userIdToUser: {
          select: { id: true, name: true, phone: true },
        },
        _count: {
          select: { UserMessageRead: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 프론트엔드에서 사용하기 쉽도록 데이터 변환
    const formattedMessages = messages.map(msg => ({
      ...msg,
      admin: msg.User_AdminMessage_adminIdToUser,
      user: msg.User_AdminMessage_userIdToUser,
      readCount: msg._count.UserMessageRead,
      User_AdminMessage_adminIdToUser: undefined,
      User_AdminMessage_userIdToUser: undefined,
      _count: undefined,
    }));

    // 같은 메시지를 여러 명에게 보낸 경우 그룹화
    // 그룹화 기준: 같은 title, content, messageType, adminId, 그리고 같은 시간대(1분 이내)
    const groupedMessages = new Map<string, any>();
    
    formattedMessages.forEach(msg => {
      // 그룹 키 생성: title + content + messageType + adminId + createdAt(분 단위)
      const createdAtMinute = new Date(msg.createdAt).setSeconds(0, 0);
      const groupKey = `${msg.title}|${msg.content}|${msg.messageType}|${msg.adminId}|${createdAtMinute}`;
      
      if (groupedMessages.has(groupKey)) {
        const group = groupedMessages.get(groupKey);
        // 수신자 추가
        if (msg.user) {
          group.recipients.push({
            id: msg.user.id,
            name: msg.user.name,
            phone: msg.user.phone,
            readCount: msg.readCount,
            messageId: msg.id,
          });
        }
        group.totalSent += 1;
        group.totalRead += msg.readCount;
        group.messageIds.push(msg.id);
        // isActive는 하나라도 활성화되어 있으면 활성화
        if (msg.isActive) {
          group.isActive = true;
        }
      } else {
        // 새 그룹 생성
        const recipients = msg.user ? [{
          id: msg.user.id,
          name: msg.user.name,
          phone: msg.user.phone,
          readCount: msg.readCount,
          messageId: msg.id,
        }] : [];
        
        groupedMessages.set(groupKey, {
          id: msg.id,
          title: msg.title,
          content: msg.content,
          messageType: msg.messageType,
          isActive: msg.isActive,
          createdAt: msg.createdAt,
          admin: msg.admin,
          recipients,
          totalSent: 1,
          totalRead: msg.readCount,
          messageIds: [msg.id],
        });
      }
    });

    // 그룹화된 메시지를 배열로 변환
    let groupedMessagesArray = Array.from(groupedMessages.values());

    // 읽음 상태 필터 적용 (그룹화 후)
    if (readStatus === 'read') {
      groupedMessagesArray = groupedMessagesArray.filter(msg => (msg.totalRead || 0) > 0);
    } else if (readStatus === 'unread') {
      groupedMessagesArray = groupedMessagesArray.filter(msg => {
        const totalSent = msg.totalSent || msg.recipients?.length || 1;
        const totalRead = msg.totalRead || 0;
        return totalRead < totalSent;
      });
    }

    // 정렬
    groupedMessagesArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ ok: true, messages: groupedMessagesArray });
  } catch (error) {
    logger.error('[Admin Messages GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST: 새 메시지 생성
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const body = await req.json();
    const { userIds, userId, title, content, messageType, isUrgent, sendMethod } = body;

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 발송 방식에 따라 messageType 결정
    let finalMessageType = messageType || 'info';
    if (sendMethod === 'email') {
      finalMessageType = 'email';
    } else if (sendMethod === 'kakao') {
      finalMessageType = 'kakao';
    } else if (sendMethod === 'sms') {
      finalMessageType = 'sms';
    } else if (isUrgent || sendMethod === 'cruise-guide') {
      // 크루즈가이드 메시지인 경우
      finalMessageType = isUrgent ? 'announcement' : (messageType || 'info');
    }

    // userIds 배열이 있으면 여러 고객에게 발송
    const targetUserIds = userIds && Array.isArray(userIds) ? userIds : (userId ? [userId] : []);

    // 크루즈 가이드 AI 사용자만 필터링 (Trip이 있는 사용자)
    let finalUserIds: number[] = [];
    if (targetUserIds.length > 0) {
      const usersWithTrip = await prisma.user.findMany({
        where: {
          id: { in: targetUserIds.map((id: any) => parseInt(id)) },
          role: 'user',
          Trip: { some: {} },
        },
        select: { id: true },
      });
      finalUserIds = usersWithTrip.map(u => u.id);
    } else {
      // 전체 고객 대상이면 크루즈 가이드 AI 사용자만
      const allUsersWithTrip = await prisma.user.findMany({
        where: {
          role: 'user',
          Trip: { some: {} },
        },
        select: { id: true },
      });
      finalUserIds = allUsersWithTrip.map(u => u.id);
    }

    const totalUsersWithTrip = finalUserIds.length;

    if (totalUsersWithTrip === 0) {
      return NextResponse.json(
        { ok: false, error: '발송할 고객이 없습니다. 크루즈 가이드 AI를 사용하는 고객이 없거나 선택한 고객이 조건에 맞지 않습니다.' },
        { status: 400 }
      );
    }

    // 각 사용자에게 개별 메시지 생성
    const createdMessages = [];
    for (const targetUserId of finalUserIds) {
      const message = await prisma.adminMessage.create({
        data: {
          adminId: admin.id,
          userId: targetUserId,
          title,
          content,
          messageType: finalMessageType,
          totalSent: 1,
          updatedAt: new Date(),
        },
      });
      createdMessages.push(message);
    }

    return NextResponse.json({ 
      ok: true, 
      messages: createdMessages,
      totalSent: totalUsersWithTrip,
    });
  } catch (error) {
    logger.error('[Admin Messages POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create message' },
      { status: 500 }
    );
  }
}

// DELETE: 메시지 삭제 (그룹 메시지 전체 삭제 지원)
export async function DELETE(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const deleteGroup = searchParams.get('deleteGroup') === 'true'; // 그룹 전체 삭제 여부

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '메시지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const messageId = parseInt(id);

    // 메시지가 존재하는지 확인
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

    let messageIdsToDelete: number[] = [messageId];

    // 그룹 메시지 전체 삭제인 경우
    if (deleteGroup) {
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
          createdAt: {
            gte: groupStartTime,
            lt: groupEndTime,
          },
        },
        select: { id: true },
      });

      messageIdsToDelete = groupMessages.map(m => m.id);
    }

    // 먼저 관련된 UserMessageRead 레코드들을 삭제
    await prisma.userMessageRead.deleteMany({
      where: { 
        messageId: { in: messageIdsToDelete }
      },
    });

    // 그 다음 AdminMessage 삭제
    await prisma.adminMessage.deleteMany({
      where: { 
        id: { in: messageIdsToDelete }
      },
    });

    return NextResponse.json({ 
      ok: true, 
      deletedCount: messageIdsToDelete.length,
      message: deleteGroup 
        ? `그룹 메시지 ${messageIdsToDelete.length}개가 삭제되었습니다.`
        : '메시지가 삭제되었습니다.'
    });
  } catch (error) {
    logger.error('[Admin Messages DELETE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
    
    // Prisma 에러 처리
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { ok: false, error: '메시지가 이미 삭제되었습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT: 메시지 수정 (활성화/비활성화 포함)
export async function PUT(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, content, messageType, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '메시지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (messageType !== undefined) updateData.messageType = messageType;
    if (isActive !== undefined) updateData.isActive = isActive;

    const message = await prisma.adminMessage.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    logger.error('[Admin Messages PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update message' },
      { status: 500 }
    );
  }
}

