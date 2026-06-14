import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { cancelSubscription, pauseSubscription, resumeSubscription } from '@/lib/payapp';

type Params = { params: Promise<{ id: string }> };
const TRANSITION_STATUS = {
  pause: 'pause_pending',
  resume: 'resume_pending',
  cancel: 'cancel_pending',
} as const;

const FINAL_STATUS = {
  pause: 'paused',
  resume: 'active',
  cancel: 'cancelled',
} as const;

/**
 * PATCH /api/payapp/subscription/[id]
 * 정기결제 상태 변경 (일시정지/재시작)
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
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
      const lock = await prisma.payAppSubscription.updateMany({
        where: { id, organizationId: orgId, status: 'active' },
        data: { status: TRANSITION_STATUS.pause },
      });
      if (lock.count === 0) {
        return NextResponse.json({ ok: false, message: '정기결제 상태가 변경되었습니다. 다시 시도해주세요.' }, { status: 409 });
      }

      result = await pauseSubscription(sub.rebillNo);
      if (result.ok) {
        const final = await prisma.payAppSubscription.updateMany({
          where: { id, organizationId: orgId, status: TRANSITION_STATUS.pause },
          data: { status: FINAL_STATUS.pause },
        });
        if (final.count === 0) {
          logger.error('[PayApp/Subscription] pause 후 DB 반영 실패', { id, rebillNo: sub.rebillNo });
          return NextResponse.json({ ok: false, message: '정기결제 상태 저장에 실패했습니다.' }, { status: 503 });
        }
      } else {
        await prisma.payAppSubscription.updateMany({
          where: { id, organizationId: orgId, status: TRANSITION_STATUS.pause },
          data: { status: 'active' },
        });
      }
    } else if (action === 'resume') {
      if (sub.status !== 'paused') {
        return NextResponse.json({ ok: false, message: '일시정지 상태에서만 재시작 가능합니다.' }, { status: 400 });
      }
      const lock = await prisma.payAppSubscription.updateMany({
        where: { id, organizationId: orgId, status: 'paused' },
        data: { status: TRANSITION_STATUS.resume },
      });
      if (lock.count === 0) {
        return NextResponse.json({ ok: false, message: '정기결제 상태가 변경되었습니다. 다시 시도해주세요.' }, { status: 409 });
      }

      result = await resumeSubscription(sub.rebillNo);
      if (result.ok) {
        const final = await prisma.payAppSubscription.updateMany({
          where: { id, organizationId: orgId, status: TRANSITION_STATUS.resume },
          data: { status: FINAL_STATUS.resume },
        });
        if (final.count === 0) {
          logger.error('[PayApp/Subscription] resume 후 DB 반영 실패', { id, rebillNo: sub.rebillNo });
          return NextResponse.json({ ok: false, message: '정기결제 상태 저장에 실패했습니다.' }, { status: 503 });
        }
      } else {
        await prisma.payAppSubscription.updateMany({
          where: { id, organizationId: orgId, status: TRANSITION_STATUS.resume },
          data: { status: 'paused' },
        });
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
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // 해지 사유 파싱 (body가 있으면)
    let cancelReason = '';
    try {
      const body = await req.json();
      cancelReason = body.reason ?? '';
    } catch { /* body 없으면 무시 */ }

    const sub = await prisma.payAppSubscription.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!sub) return NextResponse.json({ ok: false, message: '정기결제를 찾을 수 없습니다.' }, { status: 404 });

    if (sub.status === 'cancelled') {
      return NextResponse.json({ ok: false, message: '이미 해지된 정기결제입니다.' }, { status: 400 });
    }

    const lock = await prisma.payAppSubscription.updateMany({
      where: { id, organizationId: orgId, status: { not: 'cancelled' } },
      data: { status: TRANSITION_STATUS.cancel },
    });
    if (lock.count === 0) {
      return NextResponse.json({ ok: false, message: '정기결제 상태가 변경되었습니다. 다시 시도해주세요.' }, { status: 409 });
    }

    const result = await cancelSubscription(sub.rebillNo);
    if (!result.ok) {
      await prisma.payAppSubscription.updateMany({
        where: { id, organizationId: orgId, status: TRANSITION_STATUS.cancel },
        data: { status: sub.status },
      });
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    const final = await prisma.payAppSubscription.updateMany({
      where: { id, organizationId: orgId, status: TRANSITION_STATUS.cancel },
      data: { status: FINAL_STATUS.cancel },
    });
    if (final.count === 0) {
      logger.error('[PayApp/Subscription] cancel 후 DB 반영 실패', { id, rebillNo: sub.rebillNo });
      return NextResponse.json({ ok: false, message: '정기결제 상태 저장에 실패했습니다.' }, { status: 503 });
    }

    logger.log('[PayApp/Subscription] 해지 완료', { id, rebillNo: sub.rebillNo, reason: cancelReason });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PayApp/Subscription] 해지 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
