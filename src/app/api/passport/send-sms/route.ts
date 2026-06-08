export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { sendSms, resolveUserSmsConfig } from '@/lib/aligo';
import { logger } from '@/lib/logger';
import { validatePassportSmsRequest, maskUserByRole, auditLog, extractIp } from '@/lib/passport-security';

interface SendSmsRequest {
  tripId: number;
  userIds: number[]; // 발송 대상 고객 ID 배열
  templateType?: 'basic' | 'reminder' | 'urgent'; // 메시지 템플릿 타입
}

interface SendSmsResponse {
  ok: boolean;
  messageId?: string;
  status?: string;
  sentAt?: string;
  estimatedCost?: string;
  errors?: Array<{ userId: number; error: string }>;
  successCount?: number;
  failureCount?: number;
}

/**
 * POST /api/passport/send-sms
 * 여권 제출 요청 SMS 발송
 *
 * 보안 강화 (Team D):
 * ✅ 권한 검증 (ADMIN | MANAGER)
 * ✅ CSRF 토큰 검증 (X-CSRF-Token 헤더)
 * ✅ PII 마스킹 (역할별 표시)
 * ✅ 감시 로깅 (감사추적)
 *
 * 요청 시간: 초 단위 처리
 *
 * Request Body:
 * {
 *   "tripId": 123,
 *   "userIds": [1, 2, 3],
 *   "templateType": "basic" // 선택
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "successCount": 3,
 *   "failureCount": 0,
 *   "sentAt": "2026-06-08T10:30:00Z"
 * }
 */
export async function POST(req: NextRequest) {
  let ctxForAudit: any = null;

  try {
    // 1️⃣ 권한 + CSRF 검증 (통합)
    const validation = await validatePassportSmsRequest(req);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: validation.status }
      );
    }

    const ctx = validation.ctx;
    ctxForAudit = ctx;

    logger.log('[Passport SMS] 검증 완료', {
      userId: ctx.userId.substring(0, 8) + '...',
      role: ctx.role,
    });

    // 2️⃣ 요청 바디 검증
    let body: SendSmsRequest;
    try {
      body = await req.json();
    } catch {
      await auditLog({
        userId: ctx.userId,
        gmUserId: ctx.gmUserId,
        action: 'SMS_REQUEST_INVALID',
        resource: 'SMS',
        status: 'FAILURE',
        metadata: { reason: 'Invalid JSON' },
      });
      return NextResponse.json(
        { ok: false, error: '잘못된 요청 형식' },
        { status: 400 }
      );
    }

    const { tripId, userIds, templateType = 'basic' } = body;

    // 필수 필드 확인
    if (!tripId || !Array.isArray(userIds) || userIds.length === 0) {
      await auditLog({
        userId: ctx.userId,
        gmUserId: ctx.gmUserId,
        action: 'SMS_REQUEST_INVALID',
        resource: 'SMS',
        status: 'FAILURE',
        metadata: { reason: 'Missing required fields' },
      });
      return NextResponse.json(
        { ok: false, error: 'tripId와 userIds(배열) 필수' },
        { status: 400 }
      );
    }

    // 유효한 templateType 확인
    if (!['basic', 'reminder', 'urgent'].includes(templateType)) {
      return NextResponse.json(
        { ok: false, error: 'templateType: basic|reminder|urgent' },
        { status: 400 }
      );
    }

    // 3️⃣ 상품 정보 조회
    const trip = await prisma.gmTrip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        cruiseName: true,
        shipName: true,
        departureDate: true,
      },
    });

    if (!trip) {
      await auditLog({
        userId: ctx.userId,
        gmUserId: ctx.gmUserId,
        action: 'TRIP_NOT_FOUND',
        resource: 'TRIP',
        resourceId: tripId,
        status: 'FAILURE',
      });
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 4️⃣ 고객 정보 조회
    const users = await prisma.gmUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phone: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // 5️⃣ SMS 설정 조회 (조직의 Aligo 설정)
    const orgIdStr = ctx.organizationId || '';
    const smsConfig = await resolveUserSmsConfig(
      orgIdStr,
      ctx.userId
    );

    if (!smsConfig) {
      logger.warn('[Passport SMS] SMS 설정 없음', { userId: ctx.userId });
      await auditLog({
        userId: ctx.userId,
        gmUserId: ctx.gmUserId,
        action: 'SMS_CONFIG_MISSING',
        resource: 'SMS',
        status: 'FAILURE',
      });
      return NextResponse.json(
        { ok: false, error: 'SMS 설정이 없습니다' },
        { status: 500 }
      );
    }

    // 6️⃣ 메시지 템플릿 결정
    const getMessageTemplate = (
      type: string,
      name: string | null,
      cruiseName: string | null
    ): string => {
      const displayName = name ?? '고객님';
      const cruise = cruiseName ?? '여행';

      switch (type) {
        case 'reminder':
          return `[마비즈크루즈] ${displayName}님, ${cruise} 여권 제출이 남았습니다. 🔗 passport.mabiz.co.kr`;

        case 'urgent':
          return `[마비즈크루즈] ⚠️ ${displayName}님, 여권 제출 기한이 임박했습니다. 지금 제출해주세요. 🔗 passport.mabiz.co.kr`;

        case 'basic':
        default:
          return `[마비즈크루즈] ${displayName}님, ${cruise} 예약이 확정되었습니다. 여권을 제출해주세요. 🔗 passport.mabiz.co.kr`;
      }
    };

    // 7️⃣ SMS 발송 (배치)
    const errors: Array<{ userId: number; error: string }> = [];
    let successCount = 0;
    let failureCount = 0;

    const sentAt = new Date();
    const ip = extractIp(req);

    for (const userId of userIds) {
      const user = userMap.get(userId);
      if (!user || !user.phone) {
        errors.push({
          userId,
          error: user ? '전화번호 없음' : '사용자 없음',
        });
        failureCount++;
        continue;
      }

      // 8️⃣ 중복 발송 체크 (최근 24시간)
      const recentLog = await prisma.gmPassportRequestLog.findFirst({
        where: {
          userId,
          status: 'SENT',
          sentAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간 이내
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 1,
      });

      if (recentLog && recentLog.status === 'SENT') {
        logger.warn('[Passport SMS] 중복 발송 감지', { userId, tripId });
        errors.push({
          userId,
          error: '24시간 이내 이미 발송됨',
        });
        failureCount++;
        continue;
      }

      // 9️⃣ SMS 발송
      const message = getMessageTemplate(templateType, user.name, trip.cruiseName);

      try {
        const result = await sendSms({
          config: smsConfig,
          receiver: user.phone,
          msg: message,
          msgType: message.length > 90 ? 'LMS' : 'SMS',
          channel: 'MANUAL',
        });

        // 🔟 로그 기록
        await prisma.gmPassportRequestLog.create({
          data: {
            userId,
            adminId: ctx.gmUserId ?? 0,
            messageBody: message,
            messageChannel: 'SMS',
            status: result.result_code === 1 ? 'SENT' : 'FAILED',
            errorReason:
              result.result_code === 1 ? null : result.message,
            sentAt,
          },
        });

        if (result.result_code === 1) {
          successCount++;
          logger.log('[Passport SMS] 발송 성공', {
            userId,
            phone: maskUserByRole({ phone: user.phone }, ctx.role).phone,
          });
        } else {
          failureCount++;
          errors.push({
            userId,
            error: result.message || '발송 실패',
          });
          logger.warn('[Passport SMS] 발송 실패', {
            userId,
            resultCode: result.result_code,
          });
        }
      } catch (err) {
        logger.error('[Passport SMS] 발송 오류', { userId, err });
        failureCount++;
        errors.push({
          userId,
          error: '발송 중 오류',
        });

        // 에러 로그 기록
        await prisma.gmPassportRequestLog.create({
          data: {
            userId,
            adminId: ctx.gmUserId ?? 0,
            messageBody: getMessageTemplate(templateType, user.name, trip.cruiseName),
            messageChannel: 'SMS',
            status: 'FAILED',
            errorReason: String(err),
            sentAt,
          },
        });
      }
    }

    // 감시 로깅 (감사추적)
    await auditLog({
      userId: ctx.userId,
      gmUserId: ctx.gmUserId,
      action: 'SMS_BATCH_SENT',
      resource: 'TRIP',
      resourceId: tripId,
      status: failureCount === 0 ? 'SUCCESS' : 'FAILURE',
      metadata: {
        totalCount: userIds.length,
        successCount,
        failureCount,
        templateType,
        errorCount: errors.length,
      },
      ip,
    });

    logger.log('[Passport API] POST /api/passport/send-sms', {
      userId: ctx.userId.substring(0, 8) + '...',
      role: ctx.role,
      tripId,
      totalCount: userIds.length,
      successCount,
      failureCount,
      templateType,
    });

    // 🔟1️⃣ 응답 포맷팅
    const response: SendSmsResponse = {
      ok: failureCount === 0,
      successCount,
      failureCount,
      sentAt: sentAt.toISOString(),
      estimatedCost: `${successCount * 100}원`, // Aligo 기본 요금: 100원/건
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    return NextResponse.json(response, {
      status: failureCount === 0 ? 200 : 207, // 207: Multi-Status (부분 성공)
    });
  } catch (error) {
    logger.error('[Passport API] POST /api/passport/send-sms 실패', {
      error,
    });

    if (ctxForAudit) {
      await auditLog({
        userId: ctxForAudit.userId,
        gmUserId: ctxForAudit.gmUserId,
        action: 'SMS_BATCH_ERROR',
        resource: 'SMS',
        status: 'FAILURE',
        metadata: { error: error instanceof Error ? error.message : 'Unknown' },
      });
    }

    return NextResponse.json(
      { ok: false, error: 'SMS 발송 실패' },
      { status: 500 }
    );
  }
}
