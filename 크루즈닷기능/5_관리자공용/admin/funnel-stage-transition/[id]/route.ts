/**
 * Admin API: 퍼널 스테이지 전이 관리
 * 관리자가 수동으로 퍼널 상태를 변경할 수 있는 API
 * P0-3: 인증 + organizationId 검증 추가
 *
 * PATCH /api/admin/funnel-stage-transition/:id
 * body: { state: 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED', organizationId: string, reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { isValidTransition, FunnelStageState } from '@/lib/crm/schedule-calculator';

const updateTransitionSchema = z.object({
  state: z.enum(['PENDING', 'ACTIVE', 'WAITING', 'COMPLETED', 'FAILED', 'ARCHIVED']),
  organizationId: z.string().min(1, '조직 ID는 필수입니다'),
  reason: z.string().optional(),
});

type UpdateTransitionInput = z.infer<typeof updateTransitionSchema>;

interface UpdateStateResponse {
  ok: boolean;
  data?: {
    id: number;
    leadId: number | null;
    funnelId: number;
    currentState: FunnelStageState;
    lastTransitionAt: string;
    nextMessageScheduledAt?: string | null;
  };
  error?: string;
}

/**
 * PATCH /api/admin/funnel-stage-transition/:id
 * 퍼널 스테이지 상태 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<UpdateStateResponse>> {
  try {
    // P0 Security: Admin 권한 검증
    const admin = await requireAdmin();

    const transitionId = parseInt(params.id, 10);
    if (isNaN(transitionId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 전이 ID입니다' },
        { status: 400 }
      );
    }

    // 요청 바디 파싱 + Zod 검증
    const body = await request.json();
    const validated = await updateTransitionSchema.parseAsync(body);

    // 현재 전이 레코드 조회 + organizationId 필터
    const currentTransition = await prisma.funnelStageTransition.findUnique({
      where: { id: transitionId },
      select: {
        id: true,
        organizationId: true,
        currentState: true,
        lastTransitionAt: true,
        leadId: true,
        funnelId: true,
        metadata: true,
      },
    });

    if (!currentTransition) {
      logger.warn('[Funnel-Transition PATCH] 전이 레코드 없음', {
        transitionId,
        adminId: admin.userId,
      });
      return NextResponse.json(
        { ok: false, error: '전이 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // organizationId 소유권 검증 (IDOR 방지)
    if (currentTransition.organizationId !== validated.organizationId) {
      logger.warn('[Funnel-Transition PATCH] 조직 불일치 (IDOR 시도)', {
        transitionId,
        adminId: admin.userId,
        requestedOrg: validated.organizationId,
        actualOrg: currentTransition.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '전이 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 상태 전이 가능 여부 검증
    const isValid = isValidTransition(
      currentTransition.currentState as FunnelStageState,
      validated.state,
      'manual'
    );

    if (!isValid) {
      logger.warn('[Funnel-Transition PATCH] 유효하지 않은 상태 전이', {
        transitionId,
        adminId: admin.userId,
        fromState: currentTransition.currentState,
        toState: validated.state,
        reason: validated.reason,
      });

      return NextResponse.json(
        {
          ok: false,
          error: `유효하지 않은 전이: ${currentTransition.currentState} → ${validated.state}`,
        },
        { status: 400 }
      );
    }

    // 상태 업데이트
    const now = new Date();
    const updated = await prisma.funnelStageTransition.update({
      where: { id: transitionId },
      data: {
        currentState: validated.state,
        lastTransitionAt: now,
        ...(validated.state === 'FAILED' && validated.reason
          ? {
              metadata: {
                ...(currentTransition.metadata as Record<string, any>),
                failureReason: validated.reason,
                failedAt: now.toISOString(),
              },
            }
          : {}),
      },
    });

    logger.log('[Funnel-Transition PATCH] 상태 업데이트 성공', {
      transitionId,
      adminId: admin.userId,
      organizationId: validated.organizationId,
      fromState: currentTransition.currentState,
      toState: validated.state,
      leadId: currentTransition.leadId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        leadId: updated.leadId,
        funnelId: updated.funnelId,
        currentState: updated.currentState as FunnelStageState,
        lastTransitionAt: updated.lastTransitionAt?.toISOString() || new Date().toISOString(),
        nextMessageScheduledAt: updated.nextMessageScheduledAt?.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Funnel-Transition PATCH] 검증 오류', {
        errors: error.errors,
      });
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    logger.error('[Funnel-Transition PATCH] 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/funnel-stage-transition/:id
 * 퍼널 스테이지 전이 상태 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<UpdateStateResponse>> {
  try {
    // P0 Security: Admin 권한 검증
    const admin = await requireAdmin();

    const transitionId = parseInt(params.id, 10);
    if (isNaN(transitionId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 전이 ID입니다' },
        { status: 400 }
      );
    }

    // organizationId 쿼리 파라미터 검증
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: '조직 ID는 필수입니다' },
        { status: 400 }
      );
    }

    // 전이 레코드 조회 + organizationId 필터
    const transition = await prisma.funnelStageTransition.findUnique({
      where: { id: transitionId },
      select: {
        id: true,
        organizationId: true,
        currentState: true,
        lastTransitionAt: true,
        leadId: true,
        funnelId: true,
        nextMessageScheduledAt: true,
      },
    });

    if (!transition) {
      logger.warn('[Funnel-Transition GET] 전이 레코드 없음', {
        transitionId,
        adminId: admin.userId,
      });
      return NextResponse.json(
        { ok: false, error: '전이 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // organizationId 소유권 검증 (IDOR 방지)
    if (transition.organizationId !== organizationId) {
      logger.warn('[Funnel-Transition GET] 조직 불일치 (IDOR 시도)', {
        transitionId,
        adminId: admin.userId,
        requestedOrg: organizationId,
        actualOrg: transition.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '전이 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    logger.debug('[Funnel-Transition GET] 조회 성공', {
      transitionId,
      adminId: admin.userId,
      organizationId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: transition.id,
        leadId: transition.leadId,
        funnelId: transition.funnelId,
        currentState: transition.currentState as FunnelStageState,
        lastTransitionAt: transition.lastTransitionAt?.toISOString() || new Date().toISOString(),
        nextMessageScheduledAt: transition.nextMessageScheduledAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Funnel-Transition GET] 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/funnel-stage-transition/:id
 * 퍼널 스테이지 전이 기록 삭제 (아카이브)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<UpdateStateResponse>> {
  try {
    // P0 Security: Admin 권한 검증
    const admin = await requireAdmin();

    const transitionId = parseInt(params.id, 10);
    if (isNaN(transitionId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 전이 ID입니다' },
        { status: 400 }
      );
    }

    // organizationId 쿼리 파라미터 검증
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: '조직 ID는 필수입니다' },
        { status: 400 }
      );
    }

    // 전이 레코드 조회 + organizationId 필터
    const transition = await prisma.funnelStageTransition.findUnique({
      where: { id: transitionId },
      select: {
        id: true,
        organizationId: true,
        currentState: true,
        leadId: true,
        funnelId: true,
      },
    });

    if (!transition) {
      logger.warn('[Funnel-Transition DELETE] 전이 레코드 없음', {
        transitionId,
        adminId: admin.userId,
      });
      return NextResponse.json(
        { ok: false, error: '전이 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // organizationId 소유권 검증 (IDOR 방지)
    if (transition.organizationId !== organizationId) {
      logger.warn('[Funnel-Transition DELETE] 조직 불일치 (IDOR 시도)', {
        transitionId,
        adminId: admin.userId,
        requestedOrg: organizationId,
        actualOrg: transition.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '전이 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // ARCHIVED 상태로 변경 (물리 삭제 아님)
    const archived = await prisma.funnelStageTransition.update({
      where: { id: transitionId },
      data: {
        currentState: 'ARCHIVED',
        lastTransitionAt: new Date(),
      },
    });

    logger.log('[Funnel-Transition DELETE] 아카이브 성공', {
      transitionId,
      adminId: admin.userId,
      organizationId,
      leadId: transition.leadId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: archived.id,
        leadId: archived.leadId,
        funnelId: archived.funnelId,
        currentState: archived.currentState as FunnelStageState,
        lastTransitionAt: archived.lastTransitionAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Funnel-Transition DELETE] 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
