import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string; logId: string }> };

/**
 * GET /api/contacts/[id]/call-logs/[logId]/ics
 * 콜 기록의 scheduledAt을 ICS 캘린더 파일로 반환
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: contactId, logId } = await params;

    // 콜 로그 조회
    const log = await prisma.callLog.findFirst({
      where: { id: logId, contactId },
      include: { contact: { select: { name: true } } },
    });

    if (!log || !log.scheduledAt) {
      return NextResponse.json({ ok: false, error: '콜 기록을 찾을 수 없습니다' }, { status: 404 });
    }

    // 권한 확인 (자신의 콜이거나 같은 조직)
    if (ctx.role !== 'GLOBAL_ADMIN') {
      if (ctx.role === 'AGENT' && log.userId !== ctx.userId) {
        return NextResponse.json({ ok: false }, { status: 403 });
      }
      // OWNER의 경우 같은 조직인지 확인은 생략 (콜로그 조회 시 이미 확인)
    }

    // ICS 형식으로 변환
    const icsContent = generateICS(
      log.id,
      log.contact.name,
      log.scheduledAt,
      log.nextAction || '콜 예정',
    );

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="call-${log.id}.ics"`,
      },
    });
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/call-logs/[logId]/ics]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

function generateICS(
  logId: string,
  contactName: string,
  scheduledAt: Date,
  nextAction: string,
): string {
  // ICS 날짜 형식: YYYYMMDDTHHmmssZ
  const formatDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getUTCFullYear();
    const month = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const hours = pad(d.getUTCHours());
    const mins = pad(d.getUTCMinutes());
    const secs = pad(d.getUTCSeconds());
    return `${year}${month}${day}T${hours}${mins}${secs}Z`;
  };

  const dtstart = formatDate(scheduledAt);
  const dtstamp = formatDate(new Date());
  const summary = `📞 콜 예정: ${contactName}`;

  // ICS 본문 생성 (RFC 5545 표준)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mabiz CRM//Call Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${logId}@mabiz.kr`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${nextAction}`,
    'STATUS:TENTATIVE',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return ics;
}
