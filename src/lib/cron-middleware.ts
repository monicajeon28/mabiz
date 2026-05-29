import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Cron Secret 검증 미들웨어
 *
 * 목적:
 * - 모든 Cron 라우트의 비밀번호 검증 로직을 중앙화
 * - 통일된 인증 형식: "Bearer {CRON_SECRET}"
 * - 레거시 형식도 지원: "x-vercel-cron-secret" 헤더 직접 비교
 *
 * 사용법:
 * ```typescript
 * export async function POST(req: Request) {
 *   const authResult = validateCronSecret(req);
 *   if (!authResult.ok) {
 *     return authResult.response;
 *   }
 *   // 인증 성공 후 로직 진행
 * }
 * ```
 *
 * 심리학 프레임워크 (L9 신뢰):
 * - 통일된 검증 = 시스템 일관성 + 신뢰도 상승
 * - 명확한 에러 메시지 = 투명성 + 보안 감지
 */

export interface CronValidationResult {
  ok: boolean;
  response?: NextResponse;
}

export function validateCronSecret(req: Request): CronValidationResult {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('[CRON] CRON_SECRET 환경변수 누락 - 인증 불가능');
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message: 'CRON_SECRET 환경변수가 설정되지 않았습니다.',
          code: 'MISSING_CRON_SECRET',
        },
        { status: 500 }
      ),
    };
  }

  // 1. Bearer 토큰 형식 (표준)
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    if (authHeader === `Bearer ${cronSecret}`) {
      return { ok: true };
    }
    logger.warn('[CRON] Bearer 토큰 인증 실패', {
      received: authHeader.substring(0, 10) + '***',
      expected: `Bearer ${cronSecret.substring(0, 5)}***`,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message: '인증 실패 (유효하지 않은 Bearer 토큰)',
          code: 'INVALID_BEARER_TOKEN',
        },
        { status: 401 }
      ),
    };
  }

  // 2. 레거시 형식 지원 (x-vercel-cron-secret 헤더)
  const vecelCronSecret = req.headers.get('x-vercel-cron-secret');
  if (vecelCronSecret === cronSecret) {
    logger.log('[CRON] 레거시 형식 인증 성공 (x-vercel-cron-secret)');
    return { ok: true };
  }

  // 3. 인증 실패
  logger.warn('[CRON] Cron 인증 실패', {
    hasAuthHeader: !!authHeader,
    hasVecelSecret: !!vecelCronSecret,
    ip: req.headers.get('x-forwarded-for') || 'unknown',
  });

  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        message: '인증 실패 (유효하지 않은 비밀번호)',
        code: 'INVALID_CRON_SECRET',
      },
      { status: 401 }
    ),
  };
}

/**
 * 테스트용 헬퍼: Bearer 토큰 생성
 * (로컬 테스트, 모니터링 도구 사용 시)
 *
 * ```bash
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   http://localhost:3000/api/cron/sms-day0-init
 * ```
 */
export function generateCronAuthHeader(): string {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error('CRON_SECRET 환경변수 누락');
  }
  return `Bearer ${cronSecret}`;
}
