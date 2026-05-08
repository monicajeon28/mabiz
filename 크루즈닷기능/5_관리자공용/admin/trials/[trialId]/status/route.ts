/**
 * PATCH /api/admin/trials/[trialId]/status
 * Trial 수동 상태 변경 (관리자 수단)
 *
 * P0 Security: requireAdmin() + CSRF 검증 + IDOR 방지 + 상태 머신 + Rate Limiting
 * P0 Bugs: 유효한 상태 전환만 허용
 * P1 Compliance: 감시 로그 (TrialAuditLog) + IP 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';
import {
  isValidStateTransition,
  TrialStateError,
} from '@/lib/trial-core';
import { validateCsrfToken } from '@/lib/csrf';
import { checkRateLimit, RateLimitPolicies } from '@/lib/rate-limiter';
import { logTrialAdminAction } from '@/lib/handlers/trial-audit';
import { getClientIpAddress, getUserAgent } from '@/lib/utils/ip-utils';
import { logAdminAction } from '@/lib/middleware/adminActionLogger';

// P0: Zod 입력 검증
const updateTrialStatusSchema = z.object({
  status: z.enum(['EXPIRED', 'CONVERTED', 'CANCELLED']),
  reason: z
    .string()
    .min(5, '사유는 최소 5자 이상')
    .max(500, '사유는 최대 500자')
    .optional(),
});

type UpdateTrialStatusInput = z.infer<typeof updateTrialStatusSchema>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trialId: string }> }
) {
  const clientIp = getClientIpAddress(request);
  const userAgent = getUserAgent(request);

  try {
    // P0 Security: Admin 권한 검증
    const admin = await requireAdmin();

    // P0 Security: Rate Limiting (상태 변경은 더 엄격하게 — 분당 30회)
    const rateLimitKey = `admin:trials:patch:${admin.userId}`;
    const { limited, resetTime } = await checkRateLimit(rateLimitKey, {
      limit: 30,
      windowMs: 60 * 1000,
      _type: 'api',
    });

    if (limited) {
      logger.warn('[Trial-Admin] Rate limit exceeded on PATCH', {
        adminId: admin.userId,
        clientIp: clientIp ? clientIp.substring(0, 10) : 'unknown',
      });
      return NextResponse.json(
        { ok: false, error: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After': resetTime ? Math.ceil(resetTime / 1000).toString() : '60',
          },
        }
      );
    }

    // P0: Route params 검증
    const { trialId } = await params;
    const trialIdNum = parseInt(trialId, 10);
    if (isNaN(trialIdNum) || trialIdNum <= 0) {
      logger.warn('[Trial-Admin] Invalid trial ID', {
        trialId,
        adminId: admin.userId,
        clientIp: clientIp ? clientIp.substring(0, 10) : 'unknown',
      });
      return NextResponse.json(
        { ok: false, error: '요청한 Trial을 찾을 수 없습니다' },
        { status: 400 }
      );
    }

    // P0: Body 검증
    const body = await request.json();
    const validatedBody = updateTrialStatusSchema.parse(body);

    // P0 Security: CSRF 토큰 검증 (X-CSRF-Token 헤더)
    const csrfTokenFromHeader = request.headers.get('x-csrf-token');
    const csrfTokenFromBody = (body as any)?.csrfToken;
    const csrfTokenSource = csrfTokenFromHeader || csrfTokenFromBody;

    // 쿠키에서 CSRF 토큰 조회
    const cookieStore = await cookies();
    const csrfTokenFromCookie = cookieStore.get('csrf-token')?.value;

    if (!validateCsrfToken(csrfTokenFromCookie, csrfTokenSource)) {
      logger.warn('[Trial-Admin] CSRF token validation failed', {
        adminId: admin.userId,
        trialId: trialIdNum,
        clientIp: clientIp ? clientIp.substring(0, 10) : 'unknown',
      });
      return NextResponse.json(
        { ok: false, error: 'CSRF 토큰이 유효하지 않습니다' },
        { status: 403 }
      );
    }

    const { status: newStatus, reason } = validatedBody;

    // P0 Security: Trial 조회 + 소유권 확인 (IDOR 방지)
    const trial = await prisma.trial.findUnique({
      where: { id: trialIdNum },
      select: {
        id: true,
        userId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        endedAt: true,
        User: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!trial) {
      logger.warn('[Trial-Admin] Trial not found', {
        trialId: trialIdNum,
        adminId: admin.userId,
      });
      return NextResponse.json(
        { ok: false, error: 'Trial not found' },
        { status: 404 }
      );
    }

    // P0 Bugs: 상태 머신 검증
    if (!isValidStateTransition(trial.status, newStatus)) {
      logger.warn('[Trial-Admin] Invalid state transition', {
        trialId: trialIdNum,
        currentStatus: trial.status,
        requestedStatus: newStatus,
        adminId: admin.userId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid state transition: ${trial.status} → ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // P1 Compliance: Transaction으로 원자성 보장
    const updatedTrial = await prisma.$transaction(async (tx) => {
      // Trial 업데이트
      const updated = await tx.trial.update({
        where: { id: trialIdNum },
        data: {
          status: newStatus,
          endedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          User: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      // P1 Compliance: 감시 로그 기록
      await tx.trialAuditLog.create({
        data: {
          trialId: trialIdNum,
          action: `TRIAL_${newStatus}_BY_ADMIN`,
          previousState: {
            status: trial.status,
            endedAt: trial.endedAt?.toISOString() || null,
          },
          newState: {
            status: newStatus,
            endedAt: new Date().toISOString(),
          },
          performedBy: admin.userId,
        },
      });

      return updated;
    });

    // P0 Logging: 구조화된 로깅
    logger.log('[Trial-Admin] Status updated by admin', {
      trialId: trialIdNum,
      userId: trial.userId,
      previousStatus: trial.status,
      newStatus,
      reason: reason || 'unspecified',
      adminId: admin.userId,
      adminEmail: admin.email,
      clientIp: clientIp ? clientIp.substring(0, 10) : 'unknown',
    });

    // A-3/A-7: AdminActionLog 기록 (관리자 감사 추적)
    await logAdminAction(
      admin.userId,
      'TRIAL_STATUS_UPDATE',
      trial.userId,
      {
        trialId: trialIdNum,
        from: trial.status,
        to: newStatus,
        reason: reason || 'unspecified',
      }
    );

    // P1 Compliance: 감시 로그 (IP + UserAgent 기록)
    await logTrialAdminAction({
      trialId: trialIdNum,
      action: `TRIAL_${newStatus}_BY_ADMIN` as any,
      performedBy: admin.userId,
      previousState: {
        status: trial.status,
        endedAt: trial.endedAt?.toISOString() || null,
      },
      newState: {
        status: newStatus,
        endedAt: new Date().toISOString(),
      },
      ipAddress: clientIp || 'unknown',
      userAgent: userAgent || 'unknown',
    });

    return NextResponse.json({
      ok: true,
      trial: {
        id: updatedTrial.id,
        userId: updatedTrial.userId,
        code: updatedTrial.code,
        status: updatedTrial.status,
        user: updatedTrial.User,
        updatedAt: updatedTrial.updatedAt,
      },
    });
  } catch (error) {
    // P0: Admin 인증 오류
    if (error instanceof AdminAuthError) {
      logger.warn('[Trial-Admin] Admin auth failed', {
        status: error.status,
        message: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    // P0 Bugs: 상태 머신 오류
    if (error instanceof TrialStateError) {
      logger.warn('[Trial-Admin] Trial state error', {
        message: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    // P0: Zod 검증 오류
    if (error instanceof z.ZodError) {
      logger.warn('[Trial-Admin] Input validation failed', {
        issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid request body',
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    // P0: 에러 마스킹
    logger.error('[Trial-Admin] Unhandled error in PATCH /trials/[id]/status', {
      errorType: error?.constructor?.name || 'Unknown',
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
