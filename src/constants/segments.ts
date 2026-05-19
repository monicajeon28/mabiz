/**
 * 세그먼트 상수 정의
 * 모든 세그먼트 관련 상수를 중앙에서 관리
 */

export const SEGMENT_COLORS: Record<string, string> = {
  A: '#3b82f6', // blue
  B: '#10b981', // green
  C: '#f59e0b', // orange
  D: '#ef4444', // red
  E: '#8b5cf6', // purple
};

export const SEGMENT_LABELS: Record<string, string> = {
  A: '30대 커플',
  B: '40대 가족',
  C: '중년 부부',
  D: '50-60대',
  E: '60대+',
};

export const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  A: '신혼, 낭만, 특별함 추구',
  B: '자녀 있음, 시간 부족, 추억 중시',
  C: '신뢰, 건강, 안정성 추구',
  D: '또래, 배움, 경험 추구',
  E: '가족, 안전, 간단함 추구',
};

export const ALL_SEGMENTS = ['A', 'B', 'C', 'D', 'E'] as const;

export type SegmentType = typeof ALL_SEGMENTS[number];
