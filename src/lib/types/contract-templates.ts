// 계약서 템플릿 관련 타입 정의 (Phase 6: 입력필드 지원)

export type CategoryType = "CRUISE" | "RENTAL" | "HOTEL" | "PACKAGE" | "OTHER";
export type VisibilityType = "ORGANIZATION" | "MANAGER_ONLY" | "PERSONAL";
export type StatusType = "ACTIVE" | "ARCHIVED" | "DRAFT";
export type InstanceStatusType = "DRAFT" | "SENT" | "SIGNED" | "COMPLETED";

// Phase 6: 입력필드 타입 정의
export type ContractInputFieldType = "text" | "email" | "phone" | "number" | "checkbox" | "date" | "dropdown";

/**
 * 계약서 템플릿 입력필드 정의 (Phase 6)
 * Contact 필드 또는 수동 입력을 통해 계약서에 바인딩될 필드
 */
export interface ContractInputField {
  // 고유 식별자 (HTML에서 {{fieldId}} 형식으로 사용)
  id: string;

  // 필드 타입
  type: ContractInputFieldType;

  // UI에 표시되는 라벨
  label: string;

  // 입력 필수 여부
  required: boolean;

  // 입력 필드 내 placeholder (type이 text일 때 유효)
  placeholder?: string;

  // dropdown 옵션 (type이 dropdown일 때 필수)
  options?: Array<{
    value: string;
    label: string;
  }>;

  // Contact 자동 매핑 필드명 (예: "name", "email", "birthDate", "phone")
  // null = 자동 매핑 없음, 수동 입력만 가능
  contactFieldName?: string | null;

  // 최대 길이 (text/date 필드)
  maxLength?: number;

  // 최소 길이 (text 필드)
  minLength?: number;

  // 정규식 패턴 (text 필드)
  pattern?: string;

  // 패턴 실패 시 에러 메시지
  patternError?: string;

  // 정렬 순서 (폼 렌더링 시)
  order: number;

  // 도움말 텍스트
  helpText?: string;

  // 조건부 표시 (다른 필드값에 따라 표시/숨김)
  // 예: { "fieldId": "memberType", "value": "FAMILY" }
  visibilityCondition?: {
    fieldId: string;
    value: string | boolean;
  };

  // 기본값 (UI에서 초기 표시값)
  defaultValue?: string;
}

/**
 * Contact 필드 자동 매핑 규칙 정의
 * Contact 모델의 필드를 ContractInputField로 자동 매핑
 */
export interface ContactFieldMapping {
  // Contact 필드명
  contactField: string;

  // 자동 매핑되는 입력필드 타입
  inputFieldType: ContractInputFieldType;

  // Contact 필드 설명
  description: string;

  // 필드 추출 함수 (복잡한 변환이 필요한 경우)
  // 예: birthDate → age (Contact.ageInYears)
  transformer?: (contactValue: any) => any;
}

/**
 * 지원되는 Contact-to-Input 필드 매핑 정의
 * PhoneValidator의 Contact.phone = input field text
 * EmailValidator의 Contact.email = input field text
 * BirthdateValidator의 Contact 필드 = input field date
 */
export const CONTACT_INPUT_FIELD_MAPPINGS: Record<string, ContactFieldMapping> = {
  // 기본 정보
  name: {
    contactField: "name",
    inputFieldType: "text",
    description: "연락처 이름",
    transformer: (value) => value || "",
  },
  email: {
    contactField: "email",
    inputFieldType: "text",
    description: "연락처 이메일",
    transformer: (value) => value || "",
  },
  phone: {
    contactField: "phone",
    inputFieldType: "text",
    description: "연락처 전화번호",
    transformer: (value) => value || "",
  },

  // 개인정보
  birthDate: {
    contactField: "birthDate",
    inputFieldType: "date",
    description: "생년월일",
    transformer: (value) => value ? new Date(value).toISOString().split("T")[0] : "",
  },
  age: {
    contactField: "ageInYears",
    inputFieldType: "text",
    description: "나이",
    transformer: (value) => value ? String(value) : "",
  },
  gender: {
    contactField: "gender",
    inputFieldType: "dropdown",
    description: "성별",
    transformer: (value) => value || "",
  },
  maritalStatus: {
    contactField: "maritalStatus",
    inputFieldType: "dropdown",
    description: "혼인상태",
    transformer: (value) => value || "",
  },
  childrenCount: {
    contactField: "childrenCount",
    inputFieldType: "text",
    description: "자녀수",
    transformer: (value) => value ? String(value) : "0",
  },

  // 여행 관련
  passportNumber: {
    contactField: "passportNumber",
    inputFieldType: "text",
    description: "여권번호",
    transformer: (value) => value || "",
  },
  passportDaysLeft: {
    contactField: "passportDaysLeft",
    inputFieldType: "text",
    description: "여권 유효기간 남은 일수",
    transformer: (value) => value ? String(value) : "",
  },
  cruiseInterest: {
    contactField: "cruiseInterest",
    inputFieldType: "dropdown",
    description: "크루즈 관심도",
    transformer: (value) => value || "",
  },
  cruiseCount: {
    contactField: "cruiseCount",
    inputFieldType: "text",
    description: "크루즈 탑승 횟수",
    transformer: (value) => value ? String(value) : "0",
  },
  lastCruiseDate: {
    contactField: "lastCruiseDate",
    inputFieldType: "date",
    description: "마지막 크루즈 날짜",
    transformer: (value) => value ? new Date(value).toISOString().split("T")[0] : "",
  },
  departureDate: {
    contactField: "departureDate",
    inputFieldType: "date",
    description: "출발일",
    transformer: (value) => value ? new Date(value).toISOString().split("T")[0] : "",
  },

  // 예약 정보
  bookingRef: {
    contactField: "bookingRef",
    inputFieldType: "text",
    description: "예약 참조번호",
    transformer: (value) => value || "",
  },
  productName: {
    contactField: "productName",
    inputFieldType: "text",
    description: "상품명",
    transformer: (value) => value || "",
  },
  budgetRange: {
    contactField: "budgetRange",
    inputFieldType: "dropdown",
    description: "예산 범위",
    transformer: (value) => value || "",
  },
};

export interface ContractTemplateInput {
  name: string;
  description?: string;
  category: CategoryType;
  htmlContent: string;

  // Phase 6: fieldMapping (기존) + inputFields (신규 분리)
  fieldMapping: Record<string, string>; // 단순값 매핑 (레거시)
  inputFields?: ContractInputField[]; // Phase 6: 입력필드 정의

  psychologyLenses: string[];
  smsDay0TemplateId?: string;
  smsDay1TemplateId?: string;
  smsDay2TemplateId?: string;
  smsDay3TemplateId?: string;
  visibility?: VisibilityType;
  status?: StatusType;
}

export interface ContractTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  category: string;
  htmlContent: string | null;
  fieldMapping: Record<string, any>;

  // Phase 6: 입력필드 응답 추가
  inputFields?: ContractInputField[] | null;

  psychologyLenses: string[];
  smsDay0TemplateId: string | null;
  smsDay1TemplateId: string | null;
  smsDay2TemplateId: string | null;
  smsDay3TemplateId: string | null;
  visibility: string;
  status: string;
  version: number;
  isSystemTemplate: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractInstanceInput {
  templateId: string;
  contactId?: string;

  // Phase 6: boundData (기존) + inputValues (신규 분리)
  boundData: Record<string, string>; // 기존 값 매핑 (레거시)
  inputValues?: Record<string, any>; // Phase 6: 입력필드 값 (서명 시 입력)

  autoSendSms?: boolean;
}

export interface ContractInstanceResponse {
  id: string;
  templateId: string;
  templateName: string;
  contactId: string | null;
  status: string;
  boundData?: unknown;

  // Phase 6: 입력필드 값 응답 추가
  inputValues?: Record<string, any>;

  appliedLenses?: unknown;
  signedAt?: string | null;
  expiresAt: string | null;
  timeRemaining: string;
  smsStatus: {
    day0Sent: boolean;
    day0SentAt: string | null;
    day1Sent: boolean;
    day1SentAt: string | null;
    day2Sent: boolean;
    day2SentAt: string | null;
    day3Sent: boolean;
    day3SentAt: string | null;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface ContractTemplateAuditLogResponse {
  id: string;
  templateId: string;
  action: string; // "CREATE"|"UPDATE"|"DELETE"|"RESTORE"|"PUBLISH"|"ARCHIVE"
  userId: string | null;
  previousValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  changeDescription: string | null;
  reason: string | null;
  status: string;
  errorMessage: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}
