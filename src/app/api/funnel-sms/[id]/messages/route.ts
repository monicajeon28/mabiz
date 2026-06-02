export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { ReplaceMessagesSchema } from '@/lib/schemas/funnel-sms';

type Params = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/funnel-sms/[id]/messages — 메시지 배열 전체 교체
//
// 전략:
//   1. 기존 messages 전체 삭제
//   2. 새 messages 일괄 생성 (createMany)
//
// @@unique([funnelSmsId, order]) 제약 때문에 upsert로 처리하면 order 충돌이 발생할 수 있어
// delete + createMany 방식을 채택합니다.
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: funnelSmsId } = await params;

    // IDOR 방어: 소속 조직 소유 확인
    const existing = await prisma.funnelSms.findFirst({
      where: { id: funnelSmsId, organizationId: orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '퍼널문자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await req.json();

    // 배열 길이 가드 (대용량 페이로드 조기 차단 — Zod 파싱 전)
    if (Array.isArray((body as { messages?: unknown })?.messages) &&
        (body as { messages: unknown[] }).messages.length > 500) {
      return NextResponse.json(
        { ok: false, error: 'TOO_MANY_MESSAGES', message: '최대 500개 메시지까지 가능합니다' },
        { status: 400 }
      );
    }

    const validation = ReplaceMessagesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_INPUT',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { messages } = validation.data;

    // order 중복 체크 (클라이언트 오류 방어)
    const orders = messages.map((m) => m.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'DUPLICATE_ORDER',
          message: '메시지 순서(order)가 중복되었습니다.',
        },
        { status: 400 }
      );
    }

    // 트랜잭션: 기존 삭제 → 새로 생성
    const updatedMessages = await prisma.$transaction(async (tx) => {
      await tx.funnelSmsMessage.deleteMany({ where: { funnelSmsId } });

      await tx.funnelSmsMessage.createMany({
        data: messages.map((m) => ({
          funnelSmsId,
          order: m.order,
          daysAfter: m.daysAfter,
          content: m.content,
          msgType: m.msgType,
        })),
      });

      // 생성된 메시지 반환 (order 정렬)
      return tx.funnelSmsMessage.findMany({
        where: { funnelSmsId },
        select: {
          id: true,
          order: true,
          daysAfter: true,
          content: true,
          msgType: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { order: 'asc' },
      });
    });

    logger.info('[PUT /api/funnel-sms/[id]/messages]', {
      orgId,
      funnelSmsId,
      count: updatedMessages.length,
    });

    return NextResponse.json({ ok: true, data: updatedMessages });
  } catch (err) {
    logger.error('[PUT /api/funnel-sms/[id]/messages]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
