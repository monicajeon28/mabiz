export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { unauthorized, serverError } from '@/lib/response';
import { logger } from '@/lib/logger';

// GET /api/settings/my-contract — 본인 계약 정보 조회
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (!ctx.mallUser?.id) {
      return NextResponse.json({ ok: true, contract: null });
    }

    const contract = await prisma.gmAffiliateContract.findFirst({
      where: { userId: ctx.mallUser.id },
      select: {
        status: true,
        contractStartDate: true,
        contractEndDate: true,
        contractSignedAt: true,
        signatureImageUrl: true,
        name: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ ok: true, contract: null });
    }

    logger.info('[GET /api/settings/my-contract] Success', { userId: ctx.userId });
    return NextResponse.json({ ok: true, contract });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    logger.error('[GET /api/settings/my-contract] Error', { err });
    return serverError();
  }
}
