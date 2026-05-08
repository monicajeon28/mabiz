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
    console.error('[Funnel Messages] Auth check error:', error);
    return null;
  }
}

// GET: 특정 퍼널 메시지 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const messageId = parseInt(resolvedParams.id);

    if (isNaN(messageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 메시지 ID입니다.' }, { status: 400 });
    }

    const message = await prisma.funnelMessage.findFirst({
      where: {
        id: messageId,
        adminId: admin.id,
      },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error('[Funnel Messages GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch funnel message' },
      { status: 500 }
    );
  }
}

// PUT: 퍼널 메시지 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const messageId = parseInt(resolvedParams.id);

    if (isNaN(messageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 메시지 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const {
      title,
      category,
      groupName,
      description,
      senderPhone,
      senderEmail,
      sendTime,
      optOutNumber,
      autoAddOptOut,
      isActive,
      groupId,
      stages,
    } = body;

    // 메시지 소유권 확인
    const existingMessage = await prisma.funnelMessage.findFirst({
      where: {
        id: messageId,
        adminId: admin.id,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ ok: false, error: '메시지를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 기존 단계 삭제 후 새로 생성
    await prisma.funnelMessageStage.deleteMany({
      where: { funnelMessageId: messageId },
    });

    // 메시지 수정
    const message = await prisma.funnelMessage.update({
      where: { id: messageId },
      data: {
        title: title || existingMessage.title,
        category: category !== undefined ? category : existingMessage.category,
        groupName: groupName !== undefined ? groupName : existingMessage.groupName,
        description: description !== undefined ? description : existingMessage.description,
        senderPhone: senderPhone !== undefined ? senderPhone : existingMessage.senderPhone,
        senderEmail: senderEmail !== undefined ? senderEmail : existingMessage.senderEmail,
        sendTime: sendTime !== undefined ? sendTime : existingMessage.sendTime,
        optOutNumber: optOutNumber !== undefined ? optOutNumber : existingMessage.optOutNumber,
        autoAddOptOut: autoAddOptOut !== undefined ? autoAddOptOut : existingMessage.autoAddOptOut,
        isActive: isActive !== undefined ? isActive : existingMessage.isActive,
        groupId: groupId !== undefined ? groupId : existingMessage.groupId,
        FunnelMessageStage: stages && Array.isArray(stages) && stages.length > 0
          ? {
              create: stages.map((stage: any, index: number) => ({
                stageNumber: index + 1,
                daysAfter: stage.daysAfter || 0,
                sendTime: stage.sendTime || null,
                content: stage.content,
                imageUrl: stage.imageUrl || null,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error('[Funnel Messages PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update funnel message' },
      { status: 500 }
    );
  }
}

// DELETE: 퍼널 메시지 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const messageId = parseInt(resolvedParams.id);

    if (isNaN(messageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 메시지 ID입니다.' }, { status: 400 });
    }

    // 메시지 소유권 확인
    const existingMessage = await prisma.funnelMessage.findFirst({
      where: {
        id: messageId,
        adminId: admin.id,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ ok: false, error: '메시지를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 메시지 삭제 (Cascade로 단계도 자동 삭제됨)
    await prisma.funnelMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ ok: true, message: '퍼널 메시지가 삭제되었습니다.' });
  } catch (error) {
    console.error('[Funnel Messages DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete funnel message' },
      { status: 500 }
    );
  }
}
