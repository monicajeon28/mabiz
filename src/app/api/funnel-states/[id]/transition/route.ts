import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId, BONSA_ORG_ID } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { isValidTransition, FunnelState, FunnelStateMetadata } from '@/lib/funnel-state-machine';



function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): string {
  return ctx.role === 'GLOBAL_ADMIN' ? BONSA_ORG_ID : requireOrgId(ctx);
}

// POST /api/funnel-states/[id]/transition
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const { newState, reason, metadata } = await req.json() as {
      newState: FunnelState;
      reason?: string;
      metadata?: FunnelStateMetadata;
    };

    // 필드 검증
    if (!newState || typeof newState !== 'string') {
      return NextResponse.json(
        { ok: false, message: '상태(newState)는 필수입니다.' },
        { status: 400 }
      );
    }

    // 유효한 상태인지 확인
    const validStates: FunnelState[] = ['PENDING', 'ACTIVE', 'WAITING', 'COMPLETED', 'FAILED', 'ARCHIVED'];
    if (!validStates.includes(newState as FunnelState)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 상태입니다.' },
        { status: 400 }
      );
    }

    // 기존 상태 조회
    const state = await prisma.contactFunnelState.findUnique({
      where: { id },
      include: { contact: { select: { id: true } } },
    });

    if (!state) {
      return NextResponse.json(
        { ok: false, message: '퍼널 상태를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // IDOR 방지: 조직 ID 검증
    if (state.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 상태 전이 유효성 검사
    const currentState = state.status as FunnelState;
    if (!isValidTransition(currentState, newState, 'manual')) {
      return NextResponse.json(
        {
          ok: false,
          message: `${currentState}에서 ${newState}로 전이할 수 없습니다.`,
          currentState,
          attemptedNewState: newState,
        },
        { status: 400 }
      );
    }

    // 메타데이터 병합 (기존 데이터 유지)
    const updatedMetadata: FunnelStateMetadata = {
      ...(state.metadata as FunnelStateMetadata || {}),
      ...metadata,
      lastActionAt: new Date().toISOString(),
      actionBy: ctx.userId || 'system',
    };

    // FAILED 상태일 때 failureReason 추가
    if (newState === 'FAILED' && reason) {
      updatedMetadata.failureReason = reason;
    }

    // 상태 업데이트
    await prisma.contactFunnelState.updateMany({
      where: { id, organizationId: orgId },
      data: {
        status: newState,
        metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
    const updated = await prisma.contactFunnelState.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    logger.info('[POST /api/funnel-states/[id]/transition] 상태 전이 성공', {
      stateId: id,
      contactId: state.contact.id,
      organizationId: orgId,
      from: currentState,
      to: newState,
      userId: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      data: updated,
      message: `상태가 ${currentState}에서 ${newState}로 변경되었습니다.`,
    });
  } catch (err) {
    logger.error('[POST /api/funnel-states/[id]/transition]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
