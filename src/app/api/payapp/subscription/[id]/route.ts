import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { cancelSubscription, pauseSubscription, resumeSubscription } from '@/lib/payapp';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/payapp/subscription/[id]
 * 정기결제 상태 변경 (일시정지/재시작)
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;
    const { action } = await req.json() as { action: 'pause' | 'resume' };

    const sub = await prisma.payAppSubscription.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!sub) return NextResponse.json({ ok: false, message: '정기결제를 찾을 수 없습니다.' }, { status: 404 });

    let result;
    if (action === 'pause') {
      if (sub.status !== 'active') {
        return NextResponse.json({ ok: false, message: '활성 상태에서만 일시정지 가능합니다.' }, { status: 400 });
      }
      result = await pauseSubscription(sub.rebillNo);
      if (result.ok) {
        await prisma.payAppSubscription.update({ where: { id }, data: { status: 'paused' } });
      }
    } else if (action === 'resume') {
      if (sub.status !== 'paused') {
        return NextResponse.json({ ok: false, message: '일시정지 상태에서만 재시작 가능합니다.' }, { status: 400 });
      }
      result = await resumeSubscription(sub.rebillNo);
      if (result.ok) {
        await prisma.payAppSubscription.update({ where: { id }, data: { status: 'active' } });
      }
    } else {
      return NextResponse.json({ ok: false, message: 'action은 pause 또는 resume만 가능합니다.' }, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    logger.log('[PayApp/Subscription] 상태 변경', { id, action });
    return NextResponse.json({ ok: true, action });
  } catch (err) {
    logger.error('[PayApp/Subscription] 상태 변경 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * DELETE /api/payapp/subscription/[id]
 * 정기결제 해지 (복구 불가)
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    const sub = await prisma.payAppSubscription.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!sub) return NextResponse.json({ ok: false, message: '정기결제를 찾을 수 없습니다.' }, { status: 404 });

    if (sub.status === 'cancelled') {
      return NextResponse.json({ ok: false, message: '이미 해지된 정기결제입니다.' }, { status: 400 });
    }

    const result = await cancelSubscription(sub.rebillNo);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    await prisma.payAppSubscription.update({ where: { id }, data: { status: 'cancelled' } });

    logger.log('[PayApp/Subscription] 해지 완료', { id, rebillNo: sub.rebillNo });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PayApp/Subscription] 해지 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
