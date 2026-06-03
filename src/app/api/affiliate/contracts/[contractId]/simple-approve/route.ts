export const dynamic = 'force-dynamic';

/**
 * PUT /api/affiliate/contracts/[contractId]/simple-approve
 *
 * 크루즈닷 파트너스(CRUISE_PARTNER) 신청 승인 — 계정 생성 없이 상태만 변경
 * 접근 권한: GLOBAL_ADMIN 또는 담당 대리점장 (OWNER/AGENT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !['GLOBAL_ADMIN', 'OWNER', 'AGENT'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const { contractId: contractIdStr } = await params;
    const contractId = parseInt(contractIdStr, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return NextResponse.json({ ok: false, message: '유효한 신청 ID가 아닙니다.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const note: string = typeof body.note === 'string' ? body.note.trim() : '';

    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, metadata: true, name: true, phone: true },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};
    const contractType = meta.type as string | undefined;

    // 이 엔드포인트는 CRUISE_PARTNER 전용
    if (contractType !== 'CRUISE_PARTNER') {
      return NextResponse.json(
        { ok: false, message: '이 엔드포인트는 크루즈닷 파트너스 신청에만 사용할 수 있습니다.' },
        { status: 400 },
      );
    }
    if (contract.status === 'APPROVED') {
      return NextResponse.json({ ok: false, message: '이미 승인된 신청입니다.' }, { status: 409 });
    }
    if (contract.status === 'rejected') {
      return NextResponse.json({ ok: false, message: '반려된 신청은 승인할 수 없습니다.' }, { status: 409 });
    }

    const completionToken = randomUUID();
    const completionLink = `${process.env.NEXT_PUBLIC_APP_URL}/affiliate/pre-sales/complete?token=${completionToken}`;

    await prisma.gmAffiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'APPROVED',
        metadata: {
          ...meta,
          approvedAt: new Date().toISOString(),
          approvedBy: ctx.userId,
          approveNote: note || null,
          completionToken,
          completionTokenIssuedAt: new Date().toISOString(),
          completionLink,
        },
      },
    });

    logger.info('[CRUISE-PARTNER] 신청 승인', {
      contractId,
      approvedBy: ctx.userId,
      name: contract.name,
    });

    return NextResponse.json({
      ok: true,
      message: '신청이 승인되었습니다.',
      data: { contractId, name: contract.name, completionLink },
    });
  } catch (err) {
    logger.error('[CRUISE-PARTNER] 승인 실패', { error: err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
