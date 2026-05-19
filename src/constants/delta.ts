/**
 * Delta SMS 마법사 전체 상수 모음
 * 메시지 설정, Cron 일정, 트리거 타입, 스타일 통합 관리
 */

// ============================================================================
// 1. 메시지 설정 (MESSAGE_LIMITS, DAY_CONFIG)
// ============================================================================

/** 메시지 최대 길이 (SMS 요금제 기준) */
export const MESSAGE_LIMITS = {
  DAY_0: 90, // SMS (1건)
  DAY_1: 160, // LMS (1건)
  DAY_2: 160, // LMS (1건)
  DAY_3: 160, // LMS (1건) - 선택사항이지만 권장
} as const;

/** Day별 메시지 설정 (메시지+심리학) */
export const DAY_CONFIG = [
  {
    day: 0,
    label: 'Day 0',
    title: '구매 직후',
    description: '여행 전 불안 해소',
    emoji: '💬',
    maxLength: MESSAGE_LIMITS.DAY_0,
    psychology: 'Problem Awareness (손실회피)',
    triggerType: 'PURCHASE' as const,
    isRequired: true,
  },
  {
    day: 1,
    label: 'Day 1',
    title: '+1일',
    description: '선택 고민 해소',
    emoji: '💬',
    maxLength: MESSAGE_LIMITS.DAY_1,
    psychology: 'Social Proof',
    triggerType: 'PURCHASE' as const,
    isRequired: true,
  },
  {
    day: 2,
    label: 'Day 2',
    title: '+2일',
    description: '희소성/긴급성',
    emoji: '💬',
    maxLength: MESSAGE_LIMITS.DAY_2,
    psychology: 'Scarcity (희소성)',
    triggerType: 'PURCHASE' as const,
    isRequired: true,
  },
  {
    day: 3,
    label: 'Day 3',
    title: '+3일',
    description: '최종 클로징',
    emoji: '💬',
    maxLength: MESSAGE_LIMITS.DAY_3,
    psychology: 'Loss Aversion (손실회피)',
    triggerType: 'PURCHASE' as const,
    isRequired: true,
    badge: '✅ 필수 (Phase 2)',
  },
] as const;

export type DayConfig = (typeof DAY_CONFIG)[number];
export type DayNumber = DayConfig['day'];

// ============================================================================
// 2. Cron 일정 설정
// ============================================================================

/** Cron 스케줄 설정 (발송 시간, 예상 건수, 소요시간) */
export const CRON_SCHEDULES = [
  {
    hour: 9,
    time: '09:00',
    day: 0,
    title: 'Day 0',
    description: '구매 직후 (오전)',
    timezone: 'Asia/Seoul (KST)',
    estimatedCount: '~2,400건',
    estimatedDuration: '<5분',
    messageType: 'SMS' as const,
  },
  {
    hour: 14,
    time: '14:00',
    day: 1,
    title: 'Day 1',
    description: '+1일 (오후)',
    timezone: 'Asia/Seoul (KST)',
    estimatedCount: '~1,800건',
    estimatedDuration: '<4분',
    messageType: 'LMS' as const,
  },
  {
    hour: 19,
    time: '19:00',
    days: [2, 3],
    day: 2,
    title: 'Day 2/3',
    description: '+2/3일 (저녁)',
    timezone: 'Asia/Seoul (KST)',
    estimatedCount: '~1,200건',
    estimatedDuration: '<3분',
    messageType: 'LMS' as const,
  },
] as const;

export type CronSchedule = (typeof CRON_SCHEDULES)[number];

/**
 * Cron 시간대 (환경변수로 커스터마이징 가능)
 * 기본값: 09:00, 14:00, 19:00 (KST)
 */
export const DELTA_CRON_TIMES =
  process.env.DELTA_CRON_TIMES?.split(',') || ['09:00', '14:00', '19:00'];

// ============================================================================
// 3. 메시지 상태 및 스타일
// ============================================================================

export const MESSAGE_STATUS = {
  SAFE: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: '✓',
    label: '안전',
  },
  WARNING: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: '⚠',
    label: '주의',
  },
  DANGER: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: '✗',
    label: '초과',
  },
} as const;

export type MessageStatusType = keyof typeof MESSAGE_STATUS;

/**
 * 메시지 길이로 상태 결정
 * - Safe: 80% 미만
 * - Warning: 80% 이상 100% 미만
 * - Danger: 100% 이상
 */
export function getMessageStatus(
  length: number,
  maxLength: number
): MessageStatusType {
  const percent = (length / maxLength) * 100;
  if (percent < 80) return 'SAFE';
  if (percent < 100) return 'WARNING';
  return 'DANGER';
}

// ============================================================================
// 4. 트리거 타입 (현재: PURCHASE만 사용, 향후 확장)
// ============================================================================

export const TRIGGER_TYPES = {
  PURCHASE: {
    value: 'PURCHASE',
    label: '구매 후',
    description: '고객이 렌탈을 예약한 직후',
    isEnabled: true,
  },
  ABANDONED: {
    value: 'ABANDONED',
    label: '장바구니 이탈',
    description: '예약했으나 미완료 고객 대상',
    isEnabled: false, // 향후 기능
  },
} as const;

export type TriggerType = keyof typeof TRIGGER_TYPES;

// ============================================================================
// 5. 헬퍼 함수
// ============================================================================

/**
 * Day 번호로 메시지 최대 길이 조회
 * @param day Day 번호 (0~3)
 * @returns 최대 길이 (기본값: 160)
 */
export function getDayMessageLimit(day: DayNumber): number {
  return DAY_CONFIG.find((d) => d.day === day)?.maxLength || 160;
}

/**
 * Cron 시간을 한국시간(KST) 형식으로 포맷팅
 * @param hour 시간 (0~23)
 * @returns "오전/오후 H:MM" 형식
 */
export function formatTimeKST(hour: number): string {
  const time = new Date();
  time.setHours(hour, 0, 0, 0);

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(time);
}

/**
 * Day별 예상 발송 건수 계산 (감소율 적용)
 * - Day 0: 100% (기준값 2,400건)
 * - Day 1: 75% (1,800건)
 * - Day 2: 50% (1,200건)
 * - Day 3: 50% (1,200건)
 *
 * @param day Day 번호 (0~3)
 * @param baseCount 기준 발송 건수 (기본값: 2400)
 * @returns 예상 발송 건수
 */
export function estimateCountByDay(
  day: number,
  baseCount: number = 2400
): number {
  const rates = [1.0, 0.75, 0.5, 0.5]; // Day 0부터 순서대로
  return Math.round(baseCount * (rates[day] || 0.5));
}

/**
 * 메시지 길이를 "current/max" 형식으로 포맷팅
 * @param length 현재 메시지 길이
 * @param maxLength 최대 길이
 * @returns "123/160" 형식
 */
export function formatMessageLength(length: number, maxLength: number): string {
  return `${length}/${maxLength}`;
}

/**
 * 메시지 길이 비율(%) 계산
 * @param length 현재 메시지 길이
 * @param maxLength 최대 길이
 * @returns 비율 (0~100+)
 */
export function calculateMessagePercent(
  length: number,
  maxLength: number
): number {
  return Math.round((length / maxLength) * 100);
}

/**
 * Day 설정을 Day 번호로 조회
 * @param day Day 번호
 * @returns Day 설정 객체 또는 undefined
 */
export function getDayConfig(day: DayNumber): DayConfig | undefined {
  return DAY_CONFIG.find((d) => d.day === day);
}

/**
 * Cron 스케줄을 시간(hour)으로 조회
 * @param hour 시간 (9, 14, 19 등)
 * @returns Cron 스케줄 객체 또는 undefined
 */
export function getCronScheduleByHour(hour: number): CronSchedule | undefined {
  return CRON_SCHEDULES.find((s) => s.hour === hour);
}

/**
 * 트리거 타입이 활성화되어 있는지 확인
 * @param triggerType 트리거 타입
 * @returns 활성화 여부
 */
export function isTriggerTypeEnabled(triggerType: TriggerType): boolean {
  return TRIGGER_TYPES[triggerType]?.isEnabled ?? false;
}

// ============================================================================
// 5-1. MESSAGE_INPUT_CONFIG (MessageSelector용 상수화)
// ============================================================================

export const MESSAGE_INPUT_CONFIG = [
  {
    day: 'day0' as const,
    label: '📲 Day 0: 구매 직후',
    description: '구매 당일 오전 - 불안감 해소 + 문제인식',
    maxLength: MESSAGE_LIMITS.DAY_0,
    required: true,
  },
  {
    day: 'day1' as const,
    label: '📤 Day 1: +1일',
    description: '구매 다음날 - 사회적 증거 + 구체적 수치',
    maxLength: MESSAGE_LIMITS.DAY_1,
    required: true,
  },
  {
    day: 'day2' as const,
    label: '⏰ Day 2: +2일',
    description: '구매 3일 후 - 긴급성 + 희소성 + 보상',
    maxLength: MESSAGE_LIMITS.DAY_2,
    required: true,
  },
  {
    day: 'day3' as const,
    label: '🚨 Day 3: +3일',
    description: '구매 4일 후 - 최종 긴급성 + 손실회피',
    maxLength: MESSAGE_LIMITS.DAY_3,
    required: true,
  },
] as const;

export type MessageInputConfig = (typeof MESSAGE_INPUT_CONFIG)[number];

// ============================================================================
// 6. 심리학 프레임워크 설정
// ============================================================================

/**
 * 각 Day에 적용되는 심리학 원리
 * PASONA 프레임워크와 SPIN Selling 기법 통합
 */
export const PSYCHOLOGY_FRAMEWORK = {
  DAY_0: {
    framework: 'Problem Awareness (PA)',
    principle: 'Loss Aversion (손실회피)',
    description: '미처 생각하지 못한 여행 중 불안을 깨운다',
    focus: '문제 인식',
    example: '짐 분실, 날씨 변화, 예약 변경 등의 리스크',
  },
  DAY_1: {
    framework: 'Social Proof (SP)',
    principle: 'Conformity (동조)',
    description: '다른 고객들의 긍정적 후기로 신뢰 구축',
    focus: '신뢰 강화',
    example: '평점 4.8/5.0, 이용자 23,000명 등',
  },
  DAY_2: {
    framework: 'Scarcity (SC)',
    principle: 'Urgency (긴급성)',
    description: '한정된 기회를 놓치고 싶지 않은 심리',
    focus: '즉시 행동 유도',
    example: '마지막 1개 남음, 48시간 특가 등',
  },
  DAY_3: {
    framework: 'Loss Aversion (LA)',
    principle: 'Payoff (보상)',
    description: '지금 구매하지 않으면 잃게 될 이득 강조',
    focus: '최종 클로징',
    example: '포인트 소멸, 가격 인상 공지 등',
  },
} as const;

export type PsychologyFrameworkKey = keyof typeof PSYCHOLOGY_FRAMEWORK;

// ============================================================================
// 7. UI 상수
// ============================================================================

/** 마법사 단계별 라벨 */
export const WIZARD_STEPS = {
  1: { label: 'Step 1', title: '트리거 선택', icon: '🎯' },
  2: { label: 'Step 2', title: 'Day 선택', icon: '📅' },
  3: { label: 'Step 3', title: '메시지 작성', icon: '✏️' },
  4: { label: 'Step 4', title: '시간 설정', icon: '⏰' },
  5: { label: 'Step 5', title: '검토 및 활성화', icon: '✅' },
} as const;

export type WizardStep = keyof typeof WIZARD_STEPS;

/** 메시지 타입 */
export const MESSAGE_TYPES = {
  SMS: {
    value: 'SMS',
    label: 'SMS',
    maxLength: 90,
    cost: 50,
    description: '일반 문자 (최대 90자)',
  },
  LMS: {
    value: 'LMS',
    label: 'LMS',
    maxLength: 2000,
    cost: 70,
    description: '장문 문자 (최대 2000자, 160자 이상)',
  },
} as const;

export type MessageType = keyof typeof MESSAGE_TYPES;

// ============================================================================
// 8. Day 4+ 동적 확장 가이드 (EXTENSIBILITY)
// ============================================================================

/**
 * DAY_CONFIG와 MESSAGE_INPUT_CONFIG는 배열 기반으로 설계되어
 * Day 4, Day 5 등 새로운 Day를 추가하기 쉬운 구조입니다.
 *
 * 추가 방법:
 *
 * 1. MESSAGE_LIMITS에 새 Day의 제한값 추가:
 *    ```typescript
 *    export const MESSAGE_LIMITS = {
 *      DAY_0: 90,
 *      DAY_1: 160,
 *      DAY_2: 160,
 *      DAY_3: 160,
 *      DAY_4: 160,  // 새로 추가
 *    } as const;
 *    ```
 *
 * 2. DAY_CONFIG 배열에 새 객체 추가:
 *    ```typescript
 *    export const DAY_CONFIG = [
 *      // ... 기존 Day 0-3
 *      {
 *        day: 4,
 *        label: 'Day 4',
 *        title: '+4일',
 *        description: '최종 리마인더',
 *        emoji: '💬',
 *        maxLength: MESSAGE_LIMITS.DAY_4,
 *        psychology: 'Commitment (약속)',
 *        triggerType: 'PURCHASE' as const,
 *        isRequired: false,  // 선택사항
 *      },
 *    ] as const;
 *    ```
 *
 * 3. MESSAGE_INPUT_CONFIG 배열에 새 객체 추가:
 *    ```typescript
 *    export const MESSAGE_INPUT_CONFIG = [
 *      // ... 기존 Day 0-3
 *      {
 *        day: 'day4' as const,
 *        label: '💬 Day 4: +4일',
 *        description: '구매 5일 후 - 최종 리마인더',
 *        maxLength: MESSAGE_LIMITS.DAY_4,
 *        required: false,
 *      },
 *    ] as const;
 *    ```
 *
 * 4. useDeltaWizard.ts에서 WizardState.messages 타입 확장:
 *    ```typescript
 *    interface WizardState {
 *      // ...
 *      messages: {
 *        day0: string;
 *        day1: string;
 *        day2: string;
 *        day3: string;
 *        day4?: string;  // 새로 추가
 *      };
 *    }
 *    ```
 *
 * 5. API 응답 (types/delta.ts)은 동적이므로 자동 반영됨:
 *    ```typescript
 *    schedule: Array<{ day: number; message: string }>;
 *    // schedule[4]가 자동으로 포함 가능
 *    ```
 *
 * 테스트 추가:
 * - src/__tests__/hooks/useDeltaWizard.test.ts: Day 4 검증 테스트 추가
 * - src/__tests__/components/MessagePreview.test.tsx: Day 4 렌더링 테스트 추가
 */
