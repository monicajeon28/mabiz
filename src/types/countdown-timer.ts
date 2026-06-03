/**
 * CountdownTimer TypeScript 타입 정의
 * 2026-06-03
 *
 * 작성: TypeScript 아키텍트
 * 목표: 타입 안전성 + 색상 상태 + 콜백 타입화
 */

/**
 * 남은 시간 (단위: 각각)
 * @example { days: 5, hours: 12, minutes: 30, seconds: 45 }
 */
export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * 남은 시간 (단위: 각각 + 전체 밀리초)
 * @example { days: 5, hours: 12, minutes: 30, seconds: 45, totalMs: 470445000 }
 */
export interface TimeRemainingMs extends TimeRemaining {
  /** 전체 남은 시간 (밀리초 단위) */
  totalMs: number;
}

/**
 * 색상 상태 (심리학 기반)
 * - "green": 충분함 (7일 이상 남음) → 초록색
 * - "yellow": 주의 (1시간~7일 남음) → 주황색
 * - "red": 긴급 (1시간 이하 남음) → 빨강색
 *
 * @example
 * if (status === "red") { // 1시간 이내 → 긴박감 높음
 *   showUrgencyMessage();
 * }
 */
export type CountdownColorStatus = "green" | "yellow" | "red";

/**
 * CountdownTimer 기본 Props
 *
 * @example
 * <CountdownTimer
 *   targetDate={new Date("2026-06-10")}
 *   onExpire={() => handleExpire()}
 *   onStatusChange={(status) => console.log(status)}
 * />
 */
export interface CountdownTimerProps {
  /** 마감 날짜 (Date 객체 또는 문자열) */
  targetDate: Date | string;

  /** 마감 시 콜백 */
  onExpire?: () => void;

  /** 시간 변화 시 콜백 (남은 시간 밀리초 단위) */
  onTimeChange?: (remainingMs: number) => void;

  /** 색상 상태 변화 시 콜백 */
  onStatusChange?: (status: CountdownColorStatus) => void;
}

/**
 * CountdownTimer Props (고급 버전)
 * - 문자열 마감기한 지원
 * - 고정밀도 옵션
 * - 색상 임계값 커스터마이징
 *
 * @example
 * <AdvancedCountdownTimer
 *   targetDate="2026-06-10 23:59:59"
 *   highPrecision={true}
 *   colorConfig={{ greenThresholdDays: 5 }}
 * />
 */
export interface CountdownTimerPropsAdvanced extends CountdownTimerProps {
  /** 마감 날짜 (Date 또는 문자열) */
  targetDate: Date | string;

  /** 1초 미만 정밀도 필요 여부 (기본: false) */
  highPrecision?: boolean;

  /** 색상 결정 임계값 */
  colorConfig?: {
    /** Green 상태 임계값 (일수, 기본: 7) */
    greenThresholdDays?: number;

    /** Yellow → Red 전환 임계값 (시간, 기본: 1) */
    yellowThresholdHours?: number;
  };
}

/**
 * Countdown 전체 상태
 */
export interface CountdownState {
  /** 남은 시간 */
  timeLeft: TimeRemainingMs | null;

  /** 현재 색상 상태 */
  status: CountdownColorStatus;

  /** 에러 객체 (있을 경우) */
  error: Error | null;

  /** 마감 여부 */
  isExpired: boolean;

  /** 초기 계산 중 여부 */
  isLoading: boolean;
}

/**
 * useCountdownTimer Hook 반환 타입
 *
 * @example
 * const { timeLeft, status, pause, resume } = useCountdownTimer({
 *   targetDate: "2026-06-10",
 * });
 */
export interface UseCountdownTimerReturn extends CountdownState {
  /** 마감 날짜 재설정 */
  reset: (newTargetDate: Date | string) => void;

  /** 타이머 일시정지 */
  pause: () => void;

  /** 타이머 재시작 */
  resume: () => void;
}

/**
 * Hook 옵션 타입
 */
export interface UseCountdownTimerOptions
  extends Omit<CountdownTimerPropsAdvanced, "targetDate"> {
  targetDate: Date | string;

  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
}

/**
 * 시간 계산 함수 타입
 *
 * @param diffMs 마감 시간과의 차이 (밀리초)
 * @returns TimeRemainingMs 객체
 *
 * @example
 * const result = calculateTimeRemaining(470445000);
 * // { days: 5, hours: 12, minutes: 30, seconds: 45, totalMs: 470445000 }
 */
export type TimeCalculator = (diffMs: number) => TimeRemainingMs;

/**
 * 색상 결정 함수 타입
 *
 * @param timeRemaining 남은 시간
 * @param config 임계값 설정 (옵션)
 * @returns 색상 상태
 *
 * @example
 * const color = resolveColorStatus(timeRemaining);
 * // "red" | "yellow" | "green"
 */
export type ColorResolver = (
  timeRemaining: TimeRemaining,
  config?: {
    greenThresholdDays?: number;
    yellowThresholdHours?: number;
  }
) => CountdownColorStatus;

/**
 * Interval 결정 함수 타입
 * 타이머 업데이트 주기를 결정
 *
 * @param timeRemaining 남은 시간
 * @returns 업데이트 주기 (밀리초)
 *
 * @example
 * const interval = getUpdateInterval(timeRemaining);
 * // 1000 (1초) 또는 60000 (60초)
 */
export type IntervalResolver = (timeRemaining: TimeRemaining) => number;

/**
 * 날짜 파싱 및 검증 함수 타입
 */
export type DateParser = (dateString: string) => Date;

/**
 * 마감 날짜 검증 함수 타입
 */
export type DateValidator = (targetDate: Date) => void;
