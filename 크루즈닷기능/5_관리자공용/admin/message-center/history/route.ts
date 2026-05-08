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
    console.error('[Admin Message History] Auth check error:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all'; // all, sms, email
    const status = searchParams.get('status') || 'all'; // all, sent, scheduled, failed, partial
    const senderType = searchParams.get('senderType') || 'all'; // all, admin, branch_manager, sales_agent
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';

    // 기본 조건
    const whereCondition: any = {};

    // 타입 필터
    if (type !== 'all') {
      whereCondition.messageType = type.toUpperCase();
    }

    // 상태 필터
    if (status !== 'all') {
      whereCondition.status = status.toUpperCase();
    }

    // 검색어 필터 (내용 또는 받는이 이름/연락처)
    if (search) {
      whereCondition.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 총 개수
    const total = await prisma.adminMessage.count({ where: whereCondition });

    // 메시지 목록
    const messages = await prisma.adminMessage.findMany({
      where: whereCondition,
      select: {
        id: true,
        messageType: true,
        title: true,
        recipientType: true,
        recipientCount: true,
        content: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
        targetFilters: true,
        totalSent: true,
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        admin: {
          select: {
            id: true,
            name: true,
          },
        },
        senderId: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 발신자 정보 별도 조회 (senderId가 있는 경우)
    const senderIds = [...new Set(messages.filter(m => m.senderId).map(m => m.senderId!))];
    const senders = senderIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true, role: true },
    }) : [];
    const senderMap = new Map<number, { id: number; name: string | null; role: string | null }>(
      senders.map(s => [s.id, s])
    );

    // 발신자의 파트너 프로필 정보 조회
    const partnerProfiles = senderIds.length > 0 ? await prisma.affiliateProfile.findMany({
      where: { userId: { in: senderIds } },
      select: { userId: true, type: true, displayName: true },
    }) : [];
    const profileMap = new Map<number | null, { userId: number | null; type: string; displayName: string | null }>(
      partnerProfiles.map(p => [p.userId, p])
    );

    const formattedMessages = messages.map((m) => {
      let parsedContent = m.content;
      let subject = m.title || '';
      let images: any[] = [];
      let buttons: any[] = [];

      // 이메일의 경우 JSON 파싱 시도
      if (m.messageType === 'EMAIL' || m.messageType === 'email') {
        try {
          const parsed = JSON.parse(m.content || '{}');
          subject = parsed.subject || subject;
          parsedContent = parsed.content || m.content;
          images = parsed.images || [];
          buttons = parsed.buttons || [];
        } catch {
          // JSON 파싱 실패시 원본 사용
        }
      }

      const filters = m.targetFilters as any;
      const recipients = filters?.recipients || [];
      const results = filters?.results || [];

      // 발신자 정보 결정
      let senderName = '관리자';
      let senderType = 'ADMIN';

      if (m.admin) {
        senderName = m.admin.name || '관리자';
        senderType = 'ADMIN';
      } else if (m.senderId) {
        const sender = senderMap.get(m.senderId);
        const profile = profileMap.get(m.senderId);
        if (profile) {
          senderName = profile.displayName || sender?.name || '파트너';
          senderType = profile.type;
        } else if (sender) {
          senderName = sender.name || '발신자';
          senderType = sender.role === 'admin' ? 'ADMIN' : 'USER';
        }
      }

      // 수신자 정보 (User 또는 targetFilters에서)
      let recipientInfo: any[] = [];
      if (m.User) {
        recipientInfo.push({
          name: m.User.name || '고객',
          phone: m.User.phone,
          email: m.User.email,
        });
      }
      if (recipients.length > 0) {
        recipientInfo = recipients.slice(0, 10).map((r: any) => ({
          name: r.name || '고객',
          phone: r.phone,
          email: r.email,
        }));
      }

      // 성공/실패 카운트
      const successCount = results.filter((r: any) => r.success).length ||
                          (m.status === 'SENT' ? (m.recipientCount || m.totalSent || 1) : 0);
      const failCount = results.filter((r: any) => !r.success).length ||
                       (m.status === 'FAILED' ? (m.recipientCount || m.totalSent || 1) : 0);

      return {
        id: m.id,
        type: m.messageType?.toUpperCase() || 'UNKNOWN',
        recipientType: m.recipientType,
        recipientCount: m.recipientCount || m.totalSent || 1,
        subject,
        content: parsedContent,
        images,
        buttons,
        status: m.status || 'SENT',
        scheduledAt: m.scheduledAt?.toISOString() || null,
        sentAt: m.sentAt?.toISOString() || m.createdAt.toISOString(),
        createdAt: m.createdAt.toISOString(),
        sender: {
          name: senderName,
          type: senderType,
        },
        recipients: recipientInfo,
        totalRecipients: recipients.length || m.recipientCount || m.totalSent || 1,
        successCount,
        failCount,
      };
    });

    // 발신자 유형별 필터링 (메모리에서)
    let filteredMessages = formattedMessages;
    if (senderType !== 'all') {
      filteredMessages = formattedMessages.filter(m => {
        if (senderType === 'admin') return m.sender.type === 'ADMIN';
        if (senderType === 'branch_manager') return m.sender.type === 'BRANCH_MANAGER';
        if (senderType === 'sales_agent') return m.sender.type === 'SALES_AGENT';
        return true;
      });
    }

    return NextResponse.json({
      ok: true,
      messages: filteredMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Admin Message History] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '발송 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 메시지 상세 조회
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { messageId } = await req.json();

    if (!messageId) {
      return NextResponse.json({ ok: false, error: '메시지 ID가 필요합니다.' }, { status: 400 });
    }

    const message = await prisma.adminMessage.findUnique({
      where: { id: parseInt(messageId, 10) },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        admin: {
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

    let parsedContent = message.content;
    let subject = message.title || '';
    let images: any[] = [];
    let buttons: any[] = [];

    if (message.messageType === 'EMAIL' || message.messageType === 'email') {
      try {
        const parsed = JSON.parse(message.content || '{}');
        subject = parsed.subject || subject;
        parsedContent = parsed.content || message.content;
        images = parsed.images || [];
        buttons = parsed.buttons || [];
      } catch {
        // JSON 파싱 실패시 원본 사용
      }
    }

    const filters = message.targetFilters as any;
    const recipients = filters?.recipients || [];
    const results = filters?.results || [];

    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        type: message.messageType,
        subject,
        content: parsedContent,
        images,
        buttons,
        status: message.status,
        scheduledAt: message.scheduledAt?.toISOString(),
        sentAt: message.sentAt?.toISOString(),
        createdAt: message.createdAt.toISOString(),
        sender: message.admin?.name || '관리자',
        recipients: recipients,
        results: results,
        recipientCount: message.recipientCount || message.totalSent || 1,
      },
    });
  } catch (error) {
    console.error('[Admin Message History Detail] Error:', error);
    return NextResponse.json(
      { ok: false, error: '메시지 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
