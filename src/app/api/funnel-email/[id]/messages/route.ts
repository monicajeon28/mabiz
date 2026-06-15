export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { ReplaceEmailMessagesSchema, FUNNEL_EMAIL_MAX_MESSAGES } from '@/lib/schemas/funnel-email';

type Params = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/funnel-email/[id]/messages — 이메일 메시지 배열 전체 교체
//
// 전략:
//   1. 기존 messages 전체 삭제
//   2. 새 messages 일괄 생성 (createMany)
//
// @@unique([funnelEmailId, order]) 제약 때문에 upsert로 처리하면 order 충돌이 발생할 수 있어
// delete + createMany 방식을 채택합니다.
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: funnelEmailId } = await params;

    // IDOR 방어: 소속 조직 소유 확인
    const existing = await prisma.funnelEmail.findFirst({
      where: { id: funnelEmailId, organizationId: orgId },
      select: { id: true, groups: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '자동이메일 퍼널을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await req.json();

    // 배열 길이 가드 (대용량 페이로드 조기 차단 — Zod 파싱 전)
    if (
      Array.isArray((body as { messages?: unknown })?.messages) &&
      (body as { messages: unknown[] }).messages.length > FUNNEL_EMAIL_MAX_MESSAGES
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TOO_MANY_MESSAGES',
          message: `최대 ${FUNNEL_EMAIL_MAX_MESSAGES}개 이메일까지 가능합니다.`,
        },
        { status: 400 }
      );
    }

    const validation = ReplaceEmailMessagesSchema.safeParse(body);

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
          message: '이메일 순서(order)가 중복되었습니다.',
        },
        { status: 400 }
      );
    }

    // 트랜잭션: 기존 삭제 → 새로 생성
    const updatedMessages = await prisma.$transaction(async (tx) => {
      await tx.funnelEmailMessage.deleteMany({ where: { funnelEmailId } });

      await tx.funnelEmailMessage.createMany({
        data: messages.map((m) => ({
          funnelEmailId,
          order: m.order,
          daysAfter: m.daysAfter,
          subject: m.subject,
          bodyHtml: m.bodyHtml,
          previewText: m.previewText ?? null,
        })),
      });

      // 생성된 메시지 반환 (order 정렬)
      return tx.funnelEmailMessage.findMany({
        where: { funnelEmailId },
        select: {
          id: true,
          order: true,
          daysAfter: true,
          subject: true,
          bodyHtml: true,
          previewText: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { order: 'asc' },
      });
    });

    // 이미 예약된(PENDING) 미발송 이메일 확인
    // 메시지 교체 후에도 기존 내용으로 발송될 수 있으므로 카운트 반환
    const groupIds = existing.groups.map((g) => g.id);
    const pendingEmailCount =
      groupIds.length > 0
        ? await prisma.scheduledEmailMessage.count({
            where: {
              organizationId: orgId,
              groupId: { in: groupIds },
              status: 'PENDING',
            },
          })
        : 0;

    logger.info('[PUT /api/funnel-email/[id]/messages]', {
      orgId,
      funnelEmailId,
      count: updatedMessages.length,
      pendingEmailCount,
    });

    return NextResponse.json({
      ok: true,
      data: updatedMessages,
      pendingEmailCount,
      warningMessage:
        pendingEmailCount > 0
          ? `${pendingEmailCount}건의 이미 예약된 이메일은 기존 내용으로 발송됩니다. 새 내용으로 교체하려면 예약분 동기화를 진행하세요.`
          : null,
    });
  } catch (err) {
    logger.error('[PUT /api/funnel-email/[id]/messages]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
