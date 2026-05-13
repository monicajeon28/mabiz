/**
 * 이미지 최적화 설정 (중앙화)
 * 모든 Sharp WebP 변환에서 동일한 설정 사용
 *
 * quality: 80
 *   - 범위: 1-100
 *   - 80은 높은 품질 유지하면서 파일 크기 최적화
 *   - 인지 가능한 품질 손실 없음
 *
 * effort: 3
 *   - 범위: 0-6
 *   - 3은 균형잡힌 속도/압축 (기본값)
 *   - 프로덕션: 빠른 응답 필요
 *   - 배치: 속도보다 압축 우선 가능
 */

export const WEBP_CONFIG = {
  quality: 80,
  effort: 3,
} as const;

/**
 * 배치 변환용 (서버 타임 충분, 더 나은 압축 추구)
 */
export const WEBP_BATCH_CONFIG = {
  quality: 82,
  effort: 4,
} as const;

export type WebpConfig = typeof WEBP_CONFIG;
