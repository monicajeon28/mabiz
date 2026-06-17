export const dynamic = 'force-dynamic';

/**
 * PUT /api/affiliate/contracts/[contractId]/reject — 계약 신청 반려
 *
 * 접근 권한: GLOBAL_ADMIN 또는 해당 신청의 담당 대리점장(OWNER)
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
    if (!ctx || !['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const { contractId: contractIdStr } = await params;
    const contractId = parseInt(contractIdStr, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return NextResponse.json({ ok: false, message: '유효한 신청 ID가 아닙니다.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rejectReason: string = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

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
    if (contract.status === 'REJECTED') {
      return NextResponse.json({ ok: false, message: '이미 반려된 신청입니다.' }, { status: 409 });
    }

    // BRANCH_MANAGER인 경우 자신이 담당한 신청만 반려 가능 (IDOR 방지: 실제 phone 비교)
    if (ctx.role !== 'GLOBAL_ADMIN') {
      const meta = contract.metadata as Record<string, unknown> | null;
      const supervisorPhone = meta?.supervisorPhone as string | undefined;
      if (!supervisorPhone) {
        return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
      }
      const selfMember = await prisma.organizationMember.findFirst({
        where: { userId: ctx.userId },
        select: { phone: true },
      });
      if (!selfMember?.phone || selfMember.phone !== supervisorPhone) {
        return NextResponse.json({ ok: false, message: '담당 대리점장만 반려할 수 있습니다.' }, { status: 403 });
      }
    }

    // 반려자 이름 조회 (표시용)
    let rejectedByName: string | null = null;
    try {
      const member = await prisma.organizationMember.findFirst({
        where: { userId: ctx.userId },
        select: { displayName: true },
      });
      rejectedByName = member?.displayName ?? null;
    } catch {
      // 이름 조회 실패해도 반려 처리는 계속
    }

    // P2-9: 반려사유 전용 컬럼 (GmAffiliateContract 스키마에 컬럼 추가 후 마이그레이션 필요)
    // rejectionReason, rejectedAt, rejectedById — 현재는 metadata JSON에만 저장
    // TODO: prisma migrate dev 후 아래 주석 해제
    // rejectionReason: rejectReason || null,
    // rejectedAt: new Date(),
    // rejectedById: ctx.userId ? Number(ctx.userId) : null,
    const existingMeta = (contract.metadata as Record<string, unknown> | null) ?? {};
    await prisma.gmAffiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'REJECTED',
        metadata: {
          ...existingMeta,
          rejectedAt: new Date().toISOString(),
          rejectedBy: ctx.userId,
          rejectedByName: rejectedByName,
          rejectReason: rejectReason || null,
        },
      },
    });

    // 감사 로그 (실패해도 반려 흐름에 영향 없음)
    await prisma.gmAffiliateContractAudit.create({
      data: {
        contractId,
        action: 'REJECTED',
        approvedBy: ctx.userId ? Number(ctx.userId) : null,
        reason: rejectReason || null,
      },
    }).catch((e: unknown) => logger.warn('[AFFILIATE-REJECT] 감사 로그 저장 실패', { e }));

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
