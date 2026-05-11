import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import { updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/calendar/events/[id]
 * Google Calendar 이벤트 수정
 * body: { summary?, description?, startTime?, endTime? }
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id: googleEventId } = await params;
    const ctx = await getAuthContext();

    const body = await req.json();
    const updates = {
      ...(body.summary && { summary: body.summary as string }),
      ...(body.description !== undefined && { description: body.description as string }),
      ...(body.startTime && { startTime: new Date(body.startTime) }),
      ...(body.endTime && { endTime: new Date(body.endTime) }),
    };

    const result = await updateCalendarEvent(ctx.userId, googleEventId, updates);

    if (!result.success) {
      const status = result.error === 'EVENT_NOT_FOUND' ? 404
        : result.error === 'GOOGLE_NOT_CONNECTED' ? 400 : 500;
      return NextResponse.json({ ok: false, message: result.error }, { status });
    }

    logger.info('[PUT /api/calendar/events] 이벤트 수정', {
      userId: ctx.userId,
      googleEventId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다' }, { status: 401 });
    }
    logger.error('[PUT /api/calendar/events]', { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, message: '이벤트 수정 실패' }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar/events/[id]
 * Google Calendar 이벤트 삭제
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id: googleEventId } = await params;
    const ctx = await getAuthContext();

    const result = await deleteCalendarEvent(ctx.userId, googleEventId);

    if (!result.success) {
      const status = result.error === 'EVENT_NOT_FOUND' ? 404
        : result.error === 'GOOGLE_NOT_CONNECTED' ? 400 : 500;
      return NextResponse.json({ ok: false, message: result.error }, { status });
    }

    logger.info('[DELETE /api/calendar/events] 이벤트 삭제', {
      userId: ctx.userId,
      googleEventId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다' }, { status: 401 });
    }
    logger.error('[DELETE /api/calendar/events]', { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, message: '이벤트 삭제 실패' }, { status: 500 });
  }
}
