import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

const VALID_STATUSES = [
  'pending',
  'active',
  'paused',
  'cancelled',
  'failed',
  'pause_pending',
  'resume_pending',
  'cancel_pending',
] as const;

/**
 * GET /api/payapp/subscription
 * 정기결제 목록 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const subscriptions = await prisma.payAppSubscription.findMany({
      where: {
        organizationId: orgId,
        ...(status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]) ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, subscriptions });
  } catch (err) {
    logger.error('[PayApp/Subscription] 목록 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
