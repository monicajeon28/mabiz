import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/contacts/[id]/funnel-schedule
// 해당 Contact의 ScheduledSms + ScheduledEmailMessage Day 0-3 현황 반환
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: contactId } = await params;

    // 연락처 소유권 확인 (조직 내 접근만 허용)
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId: (session.user as { organizationId?: string }).organizationId ?? '',
        deletedAt: null,
      },
      select: { id: true, name: true, email: true },
    });

    if (!contact) {
      return NextResponse.json({ ok: false, message: '연락처를 찾을 수 없습니다.' }, { status: 404 });
    }

    // SMS 발송 일정 조회 (모든 상태, 최근 20개)
    const smsSchedules = await prisma.scheduledSms.findMany({
      where: { contactId },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        round: true,
        message: true,
        channel: true,
        funnelSmsId: true,
        sentAt: true,
        failureReason: true,
      },
    });

    // 이메일 발송 일정 조회 (모든 상태, 최근 20개)
    const emailSchedules = await prisma.scheduledEmailMessage.findMany({
      where: { contactId },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        day: true,
        subject: true,
        provider: true,
        sentAt: true,
        failureReason: true,
        openedAt: true,
        clickedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      contact: {
        id: contact.id,
        name: contact.name,
        hasEmail: !!contact.email,
      },
      smsSchedules: smsSchedules.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt.toISOString(),
        status: s.status,
        round: s.round,
        channel: s.channel,
        funnelSmsId: s.funnelSmsId,
        sentAt: s.sentAt?.toISOString() ?? null,
        failureReason: s.failureReason,
        // 메시지 미리보기 (최대 50자)
        preview: s.message.length > 50 ? s.message.slice(0, 50) + '...' : s.message,
      })),
      emailSchedules: emailSchedules.map((e) => ({
        id: e.id,
        scheduledAt: e.scheduledAt.toISOString(),
        status: e.status,
        day: e.day,
        subject: e.subject,
        provider: e.provider,
        sentAt: e.sentAt?.toISOString() ?? null,
        failureReason: e.failureReason,
        openedAt: e.openedAt?.toISOString() ?? null,
        clickedAt: e.clickedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/funnel-schedule]', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
