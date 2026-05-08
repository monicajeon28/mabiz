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

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Scheduled Messages] Auth check error:', error);
    return null;
  }
}

// PUT: 예약 메시지 수정
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid message ID' }, { status: 400 });
    }

    const body = await req.json();
    const {
      title,
      category,
      groupName,
      description,
      sendMethod,
      senderName,
      senderPhone,
      senderEmail,
      optOutNumber,
      isAdMessage,
      autoAddAdTag,
      autoAddOptOut,
      startDate,
      startTime,
      maxDays,
      repeatInterval,
      targetGroupId,
      stages,
      isActive,
    } = body;

    // 기존 단계 삭제 후 새로 생성
    await prisma.scheduledMessageStage.deleteMany({
      where: { scheduledMessageId: id },
    });

    // 예약 메시지 업데이트
    const updatedMessage = await prisma.scheduledMessage.update({
      where: { id },
      data: {
        title,
        category: category || '예약메시지',
        groupName: groupName || null,
        description: description || null,
        sendMethod,
        senderName: senderName || null,
        senderPhone: senderPhone || null,
        senderEmail: senderEmail || null,
        optOutNumber: optOutNumber || null,
        isAdMessage: isAdMessage || false,
        autoAddAdTag: autoAddAdTag !== false,
        autoAddOptOut: autoAddOptOut !== false,
        startDate: startDate ? new Date(startDate) : null,
        startTime: startTime || null,
        maxDays: maxDays || (sendMethod === 'sms' ? 999999 : 99999),
        repeatInterval: repeatInterval || null,
        targetGroupId: targetGroupId || null,
        isActive: isActive !== undefined ? isActive : true,
        ScheduledMessageStage: {
          create: stages.map((stage: any, index: number) => ({
            stageNumber: stage.stageNumber || index + 1,
            daysAfter: stage.daysAfter || 0,
            sendTime: stage.sendTime || null,
            title: stage.title,
            content: stage.content,
            order: index,
          })),
        },
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Transform ScheduledMessageStage to stages for frontend
    const formattedMessage = {
      ...updatedMessage,
      stages: updatedMessage.ScheduledMessageStage || [],
    };

    return NextResponse.json({ ok: true, message: formattedMessage });
  } catch (error) {
    console.error('[Scheduled Messages PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update scheduled message' },
      { status: 500 }
    );
  }
}

// DELETE: 예약 메시지 삭제
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid message ID' }, { status: 400 });
    }

    // 단계는 CASCADE로 자동 삭제됨
    await prisma.scheduledMessage.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Scheduled Messages DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete scheduled message' },
      { status: 500 }
    );
  }
}
