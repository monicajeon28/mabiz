export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

export async function GET(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const { searchParams } = new URL(req.url);

    const type = searchParams.get('type') || 'all'; // all, sms, email
    const status = searchParams.get('status') || 'all'; // all, sent, scheduled, failed
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 프로필 ID 목록 (본인 또는 팀원)
    const isManager = profile.type === 'BRANCH_MANAGER';
    let profileIds: number[] = [profile.id];

    if (isManager && profile.managedAgents) {
      const teamIds = profile.managedAgents.map((agent: any) => agent.id).filter((id: number) => id);
      profileIds = [profile.id, ...teamIds];
    }

    // 조건 설정
    const whereCondition: any = {
      OR: [
        { senderId: sessionUser.id },
        {
          targetFilters: {
            path: ['profileId'],
            equals: profile.id,
          },
        },
        ...profileIds.map((pid) => ({
          targetFilters: {
            path: ['profileId'],
            equals: pid,
          },
        })),
      ],
    };

    // 타입 필터
    if (type !== 'all') {
      whereCondition.messageType = type.toUpperCase();
    }

    // 상태 필터
    if (status !== 'all') {
      whereCondition.status = status.toUpperCase();
    }

    // 총 개수
    const total = await prisma.adminMessage.count({ where: whereCondition });

    // 메시지 목록
    const messages = await prisma.adminMessage.findMany({
      where: whereCondition,
      select: {
        id: true,
        messageType: true,
        recipientType: true,
        recipientCount: true,
        content: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
        targetFilters: true,
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const formattedMessages = messages.map((m) => {
      let parsedContent = m.content;
      let subject = '';
      let images: any[] = [];
      let buttons: any[] = [];

      // 이메일의 경우 JSON 파싱
      if (m.messageType === 'EMAIL') {
        try {
          const parsed = JSON.parse(m.content || '{}');
          subject = parsed.subject || '';
          parsedContent = parsed.content || m.content;
          images = parsed.images || [];
          buttons = parsed.buttons || [];
        } catch {
          // JSON 파싱 실패시 원본 사용
        }
      }

      const filters = m.targetFilters as any;
      const recipients = filters?.recipients || [];

      return {
        id: m.id,
        type: m.messageType,
        recipientType: m.recipientType,
        recipientCount: m.recipientCount,
        subject,
        content: parsedContent,
        images,
        buttons,
        status: m.status,
        scheduledAt: m.scheduledAt?.toISOString() || null,
        sentAt: m.sentAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
        sender: m.User ? { id: m.User.id, name: m.User.name } : null,
        recipients: recipients.slice(0, 5), // 처음 5명만 표시
        totalRecipients: recipients.length,
      };
    });

    return NextResponse.json({
      ok: true,
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Message Center History] Error:', error);
    return NextResponse.json(
      { ok: false, message: '발송 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 예약 메시지 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('id');

    if (!messageId) {
      throw new PartnerApiError('메시지 ID가 필요합니다.', 400);
    }

    const message = await prisma.adminMessage.findUnique({
      where: { id: parseInt(messageId, 10) },
    });

    if (!message) {
      throw new PartnerApiError('메시지를 찾을 수 없습니다.', 404);
    }

    // 권한 확인
    const filters = message.targetFilters as any;
    if (message.senderId !== sessionUser.id && filters?.profileId !== profile.id) {
      throw new PartnerApiError('삭제 권한이 없습니다.', 403);
    }

    // 예약 메시지만 삭제 가능
    if (message.status !== 'SCHEDULED') {
      throw new PartnerApiError('예약된 메시지만 취소할 수 있습니다.', 400);
    }

    await prisma.adminMessage.delete({
      where: { id: parseInt(messageId, 10) },
    });

    return NextResponse.json({
      ok: true,
      message: '예약이 취소되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Message Center Delete] Error:', error);
    return NextResponse.json(
      { ok: false, message: '메시지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
