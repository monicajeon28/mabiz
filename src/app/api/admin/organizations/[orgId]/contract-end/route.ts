export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { unauthorized, forbidden, notFound, serverError } from '@/lib/response';
import { logger } from '@/lib/logger';

// PATCH /api/admin/organizations/[orgId]/contract-end — 계약 종료일 설정 (GLOBAL_ADMIN 전용)
export async function PATCH(
  req: Request,
  { params }: { params: { orgId: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') return forbidden('관리자만 접근 가능합니다.');

    const body = await req.json() as Record<string, unknown>;
    const { contractEndDate } = body;

    if (!contractEndDate || typeof contractEndDate !== 'string') {
      return NextResponse.json({ ok: false, message: '계약 종료일을 입력해주세요.' }, { status: 400 });
    }

    const date = new Date(contractEndDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ ok: false, message: '올바른 날짜 형식이 아닙니다.' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: params.orgId },
      select: { id: true },
    });
    if (!org) return notFound('조직을 찾을 수 없습니다.');

    const updated = await prisma.organization.update({
      where: { id: params.orgId },
      data: {
        contractEndDate: date,
        renewalAlertSent: false, // 날짜 변경 시 재알림 허용
      },
      select: { id: true, name: true, contractEndDate: true },
    });

    logger.info('[PATCH /admin/organizations/contract-end] 설정', {
      orgId: params.orgId,
      date: date.toISOString(),
      adminId: ctx.userId,
    });
    return NextResponse.json({ ok: true, org: updated });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    logger.error('[PATCH /admin/organizations/contract-end] Error', { err });
    return serverError();
  }
}
