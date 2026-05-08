/**
 * 퍼널 상태 머신 정의
 * 상태 전이 규칙 및 검증 로직
 */

export type FunnelState = 'PENDING' | 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

/**
 * 유효한 상태 전이 규칙
 * - PENDING: 새로운 고객 (진입 상태)
 * - ACTIVE: 퍼널 진행 중
 * - WAITING: 대기 상태 (고객 응답 대기)
 * - COMPLETED: 완료됨 (거래 성사 등)
 * - FAILED: 실패 (거래 불성사, 수정 불가)
 * - ARCHIVED: 보관됨 (최종 상태, 되돌릴 수 없음)
 */
const transitionRules: Record<FunnelState, FunnelState[]> = {
  PENDING: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['WAITING', 'FAILED', 'COMPLETED', 'ARCHIVED'],
  WAITING: ['ACTIVE', 'FAILED', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  FAILED: ['ACTIVE', 'ARCHIVED'],  // 재시도 가능
  ARCHIVED: [],  // 최종 상태
};

/**
 * 상태 전이 유효성 검사
 * @param from 현재 상태
 * @param to 목표 상태
 * @param method 전이 방법 ('manual' | 'auto')
 * @returns 전이 가능 여부
 */
export function isValidTransition(
  from: FunnelState,
  to: FunnelState,
  method: 'manual' | 'auto' = 'manual'
): boolean {
  // ARCHIVED 상태는 최종 상태로 되돌릴 수 없음
  if (from === 'ARCHIVED') {
    return false;
  }

  // 동일 상태로의 전이는 불가능
  if (from === to) {
    return false;
  }

  return transitionRules[from]?.includes(to) ?? false;
}

/**
 * 상태에 대한 설명
 */
export function getStateLabel(state: FunnelState): string {
  const labels: Record<FunnelState, string> = {
    PENDING: '대기 중',
    ACTIVE: '진행 중',
    WAITING: '응답 대기',
    COMPLETED: '완료됨',
    FAILED: '실패',
    ARCHIVED: '보관됨',
  };
  return labels[state] || state;
}

/**
 * 상태 색상 (UI 용도)
 */
export function getStateColor(state: FunnelState): string {
  const colors: Record<FunnelState, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    ACTIVE: 'bg-blue-100 text-blue-700',
    WAITING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-slate-100 text-slate-700',
  };
  return colors[state] || 'bg-gray-100 text-gray-700';
}

/**
 * 상태 진행 단계 계산 (progress bar 용도)
 */
export function getStateProgress(state: FunnelState): number {
  const progressMap: Record<FunnelState, number> = {
    PENDING: 0,
    ACTIVE: 33,
    WAITING: 66,
    COMPLETED: 100,
    FAILED: -1,  // 특수값: 실패 상태
    ARCHIVED: 100,
  };
  return progressMap[state] || 0;
}

/**
 * 상태별 가능한 다음 상태 목록
 */
export function getAvailableTransitions(from: FunnelState): FunnelState[] {
  return transitionRules[from] || [];
}

/**
 * 메타데이터 타입 정의
 */
export interface FunnelStateMetadata {
  failureReason?: string;  // 실패 이유 (FAILED 상태)
  notes?: string;           // 추가 메모
  lastActionAt?: string;    // 마지막 액션 시간
  actionBy?: string;        // 액션 수행자 ID
  [key: string]: unknown;   // 커스텀 필드
}

/**
 * 상태 전이 DTO (API 요청)
 */
export interface FunnelStateTransitionDTO {
  newState: FunnelState;
  reason?: string;           // 상태 변경 사유
  metadata?: FunnelStateMetadata;
}
