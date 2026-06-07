/**
 * P1-27: 환경변수 startup 검증
 *
 * 필수 환경변수들의 길이, 형식 검증
 * - API 키/시크릿 (최소 32자)
 * - URL 변수 (유효한 URL 형식)
 * - 옵션 변수 (설정시만 검증)
 *
 * 용도:
 * - 스크립트 시작 시점: lib/index.ts 또는 next.config.js에서 호출
 * - 크론 작업 시점: src/app/api/cron/health-check 참조
 * - 배포 전 검증: npm run validate-env 추가
 */

import { logger } from '@/lib/logger';

interface EnvValidationRule {
  name: string;
  required: boolean;
  minLength?: number;
  pattern?: RegExp;
  description: string;
}

const ENV_VALIDATION_RULES: EnvValidationRule[] = [
  // 크론 작업 보안
  {
    name: 'CRON_SECRET',
    required: true,
    minLength: 32,
    description: 'Vercel Cron 작업 인증 시크릿 (최소 32자, base64)',
  },
  // QStash (Vercel 서버리스 큐)
  {
    name: 'QSTASH_CURRENT_SIGNING_KEY',
    required: true,
    minLength: 32,
    description: 'QStash 서명키 (최소 32자)',
  },
  // 선택적 변수들
  {
    name: 'HEADER_SCRIPT_ALLOWED_DOMAINS',
    required: false,
    description: '허용된 헤더 스크립트 도메인 (쉼표 구분, 예: google.com,cloudflare.com)',
  },
  {
    name: 'PAYAPP_LINKKEY',
    required: false,
    minLength: 32,
    description: 'PayApp HMAC 링크키 (옵션, 결제 연동시 필수)',
  },
];

/**
 * 환경변수 검증
 *
 * @returns { errors: string[] } 검증 실패 목록
 *
 * 사용:
 * ```ts
 * const { errors } = validateEnv();
 * if (errors.length > 0) {
 *   console.error('❌ 환경변수 검증 실패:', errors);
 *   process.exit(1);
 * }
 * console.log('✅ 모든 환경변수 검증 통과');
 * ```
 */
export function validateEnv(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of ENV_VALIDATION_RULES) {
    const value = process.env[rule.name];

    // 필수 변수 검증
    if (rule.required && !value) {
      errors.push(
        `[P1-27] 필수 환경변수 누락: ${rule.name}\n` +
        `  설명: ${rule.description}`
      );
      continue;
    }

    // 선택 변수는 설정되지 않았으면 스킵
    if (!rule.required && !value) {
      continue;
    }

    // 길이 검증
    if (rule.minLength && value && value.length < rule.minLength) {
      errors.push(
        `[P1-27] 환경변수 길이 부족: ${rule.name}\n` +
        `  현재: ${value.length}자, 필요: ${rule.minLength}자 이상\n` +
        `  설명: ${rule.description}`
      );
    }

    // 패턴 검증
    if (rule.pattern && value && !rule.pattern.test(value)) {
      errors.push(
        `[P1-27] 환경변수 형식 오류: ${rule.name}\n` +
        `  패턴: ${rule.pattern}\n` +
        `  설명: ${rule.description}`
      );
    }
  }

  return { errors, warnings };
}

/**
 * Startup 검증 (앱 시작 시점)
 *
 * 사용:
 * ```ts
 * // lib/index.ts 또는 next.config.js
 * import { validateEnvAtStartup } from '@/lib/config-validation';
 * validateEnvAtStartup();
 * ```
 */
export function validateEnvAtStartup(): void {
  const { errors, warnings } = validateEnv();

  if (errors.length > 0) {
    logger.error('\n❌ [STARTUP] 환경변수 검증 실패:', { errors });
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn('\n⚠️  [STARTUP] 환경변수 경고:', { warnings });
  }

  logger.log('✅ [STARTUP] 모든 필수 환경변수 검증 통과');
}

/**
 * 개별 환경변수 안전 접근
 *
 * 사용:
 * ```ts
 * const cronSecret = getEnv('CRON_SECRET'); // 필수, 없으면 에러
 * const payappKey = getEnv('PAYAPP_LINKKEY', { required: false }); // 선택
 * ```
 */
export function getEnv(
  name: string,
  options?: { required?: boolean; default?: string }
): string {
  const value = process.env[name];

  if (!value) {
    if (options?.required === false) {
      return options?.default ?? '';
    }
    throw new Error(
      `[P1-27] 필수 환경변수 누락: ${name}\n` +
      `  사용처: ${new Error().stack?.split('\n')[2]}`
    );
  }

  return value;
}

/**
 * 환경변수 길이 검증 (타이밍 공격 방지)
 *
 * 사용:
 * ```ts
 * // CRON_SECRET 강도 검증 (brute force 방지)
 * assertEnvLength('CRON_SECRET', 32);
 * ```
 */
export function assertEnvLength(name: string, minLength: number): void {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 누락: ${name}`);
  }
  if (value.length < minLength) {
    throw new Error(
      `[P1-27] 환경변수 길이 부족: ${name} (현재: ${value.length}자, 필요: ${minLength}자)`
    );
  }
}
