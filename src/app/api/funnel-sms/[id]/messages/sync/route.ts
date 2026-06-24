export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { findMutableFunnelSms } from '@/lib/funnel-sms-helpers';

type Params = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/funnel-sms/[id]/messages/sync
//
// 대리점이 "예약분도 새 내용으로 교체"를 선택했을 때 호출.
//
// 배경: 메시지 교체(PUT /messages)는 FunnelSmsMessage를 delete+create 하므로
//       messageId가 새로 발급됩니다. 따라서 기존 PENDING ScheduledSms의 channel
//       (`FUNNEL_SMS:${id}:${oldMessageId}`)은 더 이상 현재 메시지와 매칭되지
//       않는 "고아(orphan)" 상태가 되어, 옛 content 그대로 발송됩니다.
//
// 처리: 이 퍼널문자에 속한 미발송(PENDING) ScheduledSms를 일괄 삭제합니다.
//       앞으로 그룹에 추가되는 고객부터 triggerGroupFunnelSms()가 새 content로
//       다시 예약하게 됩니다. (이미 SENT/FAILED 건은 건드리지 않음)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // IDOR + 수정 전용 격리: AGENT는 "본인이 만든" 퍼널만 예약 동기화(삭제·재예약) 가능
    const funnelSms = await findMutableFunnelSms(ctx, id);
    if (!funnelSms) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '퍼널문자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 미발송(PENDING) ScheduledSms 일괄 삭제 (테넌트 격리 + channel 범위 한정)
    const { count: deletedCount } = await prisma.scheduledSms.deleteMany({
      where: {
        organizationId: orgId,
        channel: { startsWith: `FUNNEL_SMS:${id}:` },
        status: 'PENDING',
      },
    });

    logger.info('[POST /api/funnel-sms/[id]/messages/sync]', {
      orgId,
      funnelSmsId: id,
      deletedCount,
    });

    return NextResponse.json({
      ok: true,
      deletedCount,
      message:
        deletedCount > 0
          ? `${deletedCount}건의 미발송 예약 문자가 삭제되었습니다. 앞으로 추가되는 고객부터 새 내용으로 발송됩니다.`
          : '교체할 미발송 예약 문자가 없습니다.',
    });
  } catch (err) {
    logger.error('[POST /api/funnel-sms/[id]/messages/sync]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
