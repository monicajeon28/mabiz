export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAffiliateRoleFilter } from '@/lib/affiliate-filters';
import { validateCsrfFromRequest } from '@/lib/api-middleware';

const VALID_TIERS = [33000, 66000, 99000];
const VALID_STATUSES = ['active', 'paused', 'cancelled'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/gold-members/[id]
 * 골드회원 정보 수정 (admin 또는 담당 manager/agent)
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    // S-1: CSRF 토큰 검증 (PUT 메서드는 상태 변경이므로 필수)
    const isCsrfValid = await validateCsrfFromRequest(req);
    if (!isCsrfValid) {
      return NextResponse.json({ ok: false, message: '요청을 처리할 수 없습니다.' }, { status: 403 });
    }

    const { id: idParam } = await context.params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    const isAdmin = userRecord?.role === 'admin' || userRecord?.role === 'superadmin';

    // 기존 골드회원 조회
    const existing = await prisma.goldMember.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, message: '골드회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 비관리자의 경우 담당 범위 내 항목만 수정 가능
    if (!isAdmin) {
      const roleFilter = await getAffiliateRoleFilter(sessionUser.id);
      if (!roleFilter) {
        return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
      }

      const { managerFilter, agentFilter, subAgentIds } = roleFilter;

      // BRANCH_MANAGER: 본인 managerId OR 부하 agentId
      // SALES_AGENT: 본인 agentId만
      const isMyBranch = existing.managerId === managerFilter;
      const isMyAgent = existing.agentId === agentFilter;
      const isSubAgent = agentFilter === undefined && subAgentIds.includes(existing.agentId || 0);

      const allowed =
        (managerFilter !== undefined && (isMyBranch || isSubAgent)) ||
        (agentFilter !== undefined && isMyAgent);

      if (!allowed) {
        return NextResponse.json({ ok: false, message: '이 골드회원에 대한 수정 권한이 없습니다.' }, { status: 403 });
      }
    }

    const body = await req.json();
    const { paymentCountIncrement, status, memo, tier, email, referredBy, managerId, agentId } = body as {
      paymentCountIncrement?: boolean;
      status?: string;
      memo?: string;
      tier?: number;
      email?: string;
      referredBy?: string;
      managerId?: number | null;
      agentId?: number | null;
    };

    // 유효성 검사
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { ok: false, message: `status는 ${VALID_STATUSES.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    if (tier !== undefined && !VALID_TIERS.includes(tier)) {
      return NextResponse.json(
        { ok: false, message: `tier는 ${VALID_TIERS.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    // 수정 데이터 구성
    const updateData: Record<string, unknown> = {};

    if (paymentCountIncrement === true) {
      if (existing.maxPaymentCount > 0 && existing.paymentCount >= existing.maxPaymentCount) {
        return NextResponse.json(
          { ok: false, message: `납입회차는 최대 ${existing.maxPaymentCount}회까지만 가능합니다.` },
          { status: 400 }
        );
      }
      updateData.paymentCount = existing.paymentCount + 1;
    }
    if (status !== undefined) updateData.status = status;
    if (memo !== undefined) updateData.memo = memo.trim();
    if (tier !== undefined) updateData.tier = tier;
    if (email !== undefined) updateData.email = email.trim() || null;
    if (referredBy !== undefined) updateData.referredBy = referredBy.trim() || null;

    // managerId/agentId 변경은 admin만 가능
    if (isAdmin) {
      if (managerId !== undefined) updateData.managerId = managerId;
      if (agentId !== undefined) updateData.agentId = agentId;
    }

    const updated = await prisma.goldMember.update({
      where: { id },
      data: updateData,
    });

    logger.debug('[admin/gold-members/[id]][PUT] 골드회원 수정', {
      id: updated.id,
      updatedBy: sessionUser.id,
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (error: unknown) {
    logger.error('[admin/gold-members/[id]][PUT] 수정 실패', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, message: '수정에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/gold-members/[id]
 * 골드회원 삭제 (admin 전용)
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (!userRecord || !['admin', 'superadmin'].includes(userRecord.role ?? '')) {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id: idParam } = await context.params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const existing = await prisma.goldMember.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, message: '골드회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.goldMember.delete({ where: { id } });

    logger.debug('[admin/gold-members/[id]][DELETE] 골드회원 삭제', {
      id,
      deletedBy: sessionUser.id,
    });

    return NextResponse.json({ ok: true, message: '삭제되었습니다.' });
  } catch (error: unknown) {
    logger.error('[admin/gold-members/[id]][DELETE] 삭제 실패', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, message: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
