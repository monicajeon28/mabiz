/**
 * Menu #38 Phase 3: Feature Flags
 *
 * 점진적 마이그레이션을 위한 Feature Flag 관리
 *
 * 환경변수:
 * - FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=true
 * - FEATURE_ENABLE_HYBRID_SENDING=true
 * - FEATURE_ENABLE_ADVANCED_RETRY=true
 */

import { logger } from '@/lib/logger';

/**
 * Feature Flag 정의
 */
export const featureFlags = {
  // Phase 3-β: 래퍼 함수 적용 (280줄 코드 감소)
  ENABLE_EXECUTION_LOG_WRAPPER: process.env.FEATURE_ENABLE_EXECUTION_LOG_WRAPPER === "true",

  // Phase 3-γ: 호환성 하이브리드 모드
  // - SendingHistory + ExecutionLog 동시 기록
  // - 롤백 안전성: 기존 API 호환 유지
  ENABLE_HYBRID_SENDING: process.env.FEATURE_ENABLE_HYBRID_SENDING === "true",

  // Phase 3-δ: 고급 재시도 로직
  // - Redis 기반 재시도 큐
  // - 보정 로직 (Clock Skew 방지)
  ENABLE_ADVANCED_RETRY: process.env.FEATURE_ENABLE_ADVANCED_RETRY === "true",

  // 개발/테스트 환경
  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === "development",
} as const;

/**
 * 타입: 사용 가능한 Feature Flag 키
 */
export type FeatureFlagKey = keyof typeof featureFlags;

/**
 * 함수: Feature Flag 값 읽기
 *
 * @param flagKey - Feature Flag 키
 * @returns boolean 값
 *
 * @example
 * if (getFeatureFlag("ENABLE_EXECUTION_LOG_WRAPPER")) {
 *   // 래퍼 함수 사용
 * }
 */
export function getFeatureFlag(flagKey: FeatureFlagKey): boolean {
  return featureFlags[flagKey];
}

/**
 * 함수: Feature Flag 상태 조회 (디버그용)
 *
 * @returns 모든 Feature Flag 상태
 */
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  return { ...featureFlags };
}

/**
 * 함수: Feature Flag 체크 + 로깅 (디버그)
 *
 * @param flagKey - Feature Flag 키
 * @param context - 컨텍스트 (선택적, 로깅용)
 * @returns boolean 값
 */
export function checkFeatureFlag(
  flagKey: FeatureFlagKey,
  context?: Record<string, any>
): boolean {
  const value = featureFlags[flagKey];

  if (featureFlags.ENABLE_DEBUG_LOGGING) {
    logger.log(`[FeatureFlag] ${flagKey} = ${value}`, context);
  }

  return value;
}

/**
 * Phase 3 전체 활성화 여부
 * - β: 래퍼 함수
 * - γ: 호환성 하이브리드
 * - δ: 자동 검증
 */
export function isPhase3Enabled(): boolean {
  return (
    featureFlags.ENABLE_EXECUTION_LOG_WRAPPER &&
    featureFlags.ENABLE_HYBRID_SENDING &&
    featureFlags.ENABLE_ADVANCED_RETRY
  );
}

/**
 * Phase 3-β 활성화 여부 (래퍼 함수만)
 */
export function isPhase3BetaEnabled(): boolean {
  return featureFlags.ENABLE_EXECUTION_LOG_WRAPPER;
}

/**
 * Phase 3-γ 활성화 여부 (호환성 하이브리드)
 */
export function isPhase3GammaEnabled(): boolean {
  return featureFlags.ENABLE_HYBRID_SENDING;
}

/**
 * Phase 3-δ 활성화 여부 (자동 검증)
 */
export function isPhase3DeltaEnabled(): boolean {
  return featureFlags.ENABLE_ADVANCED_RETRY;
}

/**
 * 테스트용
 */
export const featureFlagTests = {
  getAllFlags: getAllFeatureFlags,
  checkFlag: checkFeatureFlag,
  isPhase3: isPhase3Enabled,
  isBeta: isPhase3BetaEnabled,
  isGamma: isPhase3GammaEnabled,
  isDelta: isPhase3DeltaEnabled,
};
