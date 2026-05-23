import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/payapp/subscription
 * 정기결제 목록 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const subscriptions = await prisma.payAppSubscription.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, subscriptions });
  } catch (err) {
    logger.error('[PayApp/Subscription] 목록 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
