/**
 * Menu #38 Phase 4 Step 5-3: SMS 자동발송 시스템 타입 정의
 * 렌즈별 SMS 시퀀스 스케줄링 및 발송 추적을 위한 핵심 타입
 */

/**
 * 렌즈 타입 (L1-L10)
 */
export type LensType = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';

/**
 * SMS 발송 상태
 */
export enum SmsScheduleStatus {
  PENDING = 'PENDING',           // 발송 대기
  SCHEDULED = 'SCHEDULED',       // 스케줄 완료
  SENT = 'SENT',                 // 발송 성공
  FAILED = 'FAILED',             // 발송 실패
  RETRY_SCHEDULED = 'RETRY_SCHEDULED', // 재시도 예정
  ABANDONED = 'ABANDONED',       // 최대 재시도 초과
  SKIPPED = 'SKIPPED',           // 건너뜀 (옵트아웃 등)
}

/**
 * SMS 메시지 템플릿 구조
 */
export interface SmsTemplate {
  day: 0 | 1 | 2 | 3;            // Day (0-3)
  template: string;              // 메시지 템플릿 (변수 포함)
  variables?: string[];          // 변수 목록
  psychologyTag?: string;        // 심리학 원리 태그
}

/**
 * 렌즈별 SMS 시퀀스 정의
 */
export interface LensSequence {
  lensType: LensType;
  lensName: string;              // e.g., "L1_PRICE_RESISTANCE"
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  day0_delay_minutes: number;    // Day 0 발송 지연 시간 (기본 10분)
  templates: {
    day_0: SmsTemplate;
    day_1: SmsTemplate;
    day_2?: SmsTemplate;          // L2, L4, L5는 2일만
    day_3?: SmsTemplate;          // L6, L9, L10은 4일
  };
}

/**
 * 고객 정보 (메시지 변수 치환용)
 */
export interface ContactData {
  contactId: string;
  name: string;                  // 고객 이름
  phone: string;                 // 휴대폰 번호
  age?: number;
  gender?: 'M' | 'F';
  profession?: string;           // 직업
  familyCount?: number;          // 가족 수

  // 크루즈 정보
  shipName?: string;             // 선박명
  dateStart?: Date | string;     // 출발일
  dateEnd?: Date | string;       // 귀국일
  durationDays?: number;         // 일정 (일수)
  portList?: string;             // "일본→대만→홍콩"
  cabinType?: string;            // 선실 타입

  // 마케팅 정보
  priceBase?: number;            // 기본 가격
  priceDiscount?: number;        // 할인율 (%)
  membershipType?: 'A' | 'B' | 'C'; // 멤버십 타입
  remainingCabins?: number;      // 남은 선실 수

  // CRM 정보
  lensType?: LensType;
  createdAt?: Date;
  lastContactedAt?: Date;
  conversionStatus?: string;
}

/**
 * SMS 스케줄 아이템
 */
export interface SmsScheduleItem {
  id: string;                    // 고유 ID (DB에 저장됨)
  contactId: string;
  lensType: LensType;
  day: 0 | 1 | 2 | 3;
  messageContent: string;        // 치환된 최종 메시지
  scheduledAt: Date;             // 발송 예정 시간 (UTC)
  status: SmsScheduleStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  sentAt?: Date;
  failureReason?: string;
  messageId?: string;            // 알리고 msg_id
  openCount?: number;            // 열람 수
  clickCount?: number;           // 클릭 수
  conversion?: boolean;          // 예약 여부
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 스케줄링 결과
 */
export interface ScheduleContactLensSequenceResult {
  contactId: string;
  lensType: LensType;
  status: 'SCHEDULED' | 'SKIPPED' | 'FAILED';
  reason?: string;               // SKIPPED/FAILED 사유
  scheduledJobs: ScheduledJob[];
  totalMessages: number;
  createdAt: Date;
}

/**
 * 스케줄된 작업
 */
export interface ScheduledJob {
  day: 0 | 1 | 2 | 3;
  scheduledAt: Date;             // ISO 8601 (UTC)
  messageId?: string;            // SMS 공급자 ID (발송 후)
  status: SmsScheduleStatus;
}

/**
 * SMS 발송 실패 원인
 */
export enum SmsFailureReason {
  INVALID_PHONE = 'INVALID_PHONE',           // 유효하지 않은 번호
  OPT_OUT = 'OPT_OUT',                       // 수신거부
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',         // 일일 한도 초과
  CONTACT_DELETED = 'CONTACT_DELETED',       // 고객 삭제
  CONTACT_OPT_OUT = 'CONTACT_OPT_OUT',       // 고객 옵트아웃
  SYSTEM_ERROR = 'SYSTEM_ERROR',             // CRM 내부 오류
  PROVIDER_ERROR = 'PROVIDER_ERROR',         // 알리고 오류
  NETWORK_ERROR = 'NETWORK_ERROR',           // 네트워크 오류
  MESSAGE_BUILD_FAILED = 'MESSAGE_BUILD_FAILED', // 메시지 생성 실패
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND', // 템플릿 없음
  INVALID_VARIABLES = 'INVALID_VARIABLES',   // 변수 치환 실패
}

/**
 * 메시지 생성 컨텍스트
 */
export interface MessageBuildContext {
  lensType: LensType;
  day: 0 | 1 | 2 | 3;
  contactData: ContactData;
  templateVariables?: Record<string, string | number>;
}

/**
 * 메시지 생성 결과
 */
export interface MessageBuildResult {
  success: boolean;
  messageContent?: string;       // 평문 메시지 (최대 2,000자)
  messageLength: number;
  error?: SmsFailureReason;
  errorMessage?: string;
  warnings?: string[];           // e.g., "이모지 제거됨" 등
}
