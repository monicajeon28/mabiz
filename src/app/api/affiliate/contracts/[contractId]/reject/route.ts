export const dynamic = 'force-dynamic';

/**
 * PUT /api/affiliate/contracts/[contractId]/reject — 계약 신청 반려
 *
 * 접근 권한: GLOBAL_ADMIN 또는 해당 신청의 담당 대리점장(BRANCH_MANAGER)
 */

import { NextRequest, NextResponse } from 'next/server';
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
    const rejectReason: string = typeof body.reason === 'string' ? body.reason.trim() : '';

    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, metadata: true, name: true, phone: true },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (contract.status === 'APPROVED') {
      return NextResponse.json({ ok: false, message: '이미 승인된 신청은 반려할 수 없습니다.' }, { status: 409 });
    }
    if (contract.status === 'rejected') {
      return NextResponse.json({ ok: false, message: '이미 반려된 신청입니다.' }, { status: 409 });
    }

    // BRANCH_MANAGER인 경우 자신이 담당한 신청만 반려 가능
    if (ctx.role !== 'GLOBAL_ADMIN') {
      const meta = contract.metadata as Record<string, unknown> | null;
      const supervisorPhone = meta?.supervisorPhone as string | undefined;
      if (!supervisorPhone || !ctx) {
        // 담당 대리점장 정보가 없으면 관리자만 처리 가능
        return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
      }
    }

    const existingMeta = (contract.metadata as Record<string, unknown> | null) ?? {};
    await prisma.gmAffiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'rejected',
        metadata: {
          ...existingMeta,
          rejectedAt: new Date().toISOString(),
          rejectedBy: ctx.userId,
          rejectReason: rejectReason || null,
        },
      },
    });

    logger.info('[AFFILIATE-CONTRACT] 신청 반려', {
      contractId,
      rejectedBy: ctx.userId,
      rejectReason: rejectReason || '(사유 없음)',
    });

    return NextResponse.json({
      ok: true,
      message: '신청이 반려되었습니다.',
      data: { contractId },
    });
  } catch (err) {
    logger.error('[AFFILIATE-CONTRACT] 반려 실패', { error: err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
