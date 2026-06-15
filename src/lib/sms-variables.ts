/**
 * SMS 동적 변수 시스템 (Phase A)
 *
 * 동작 방식:
 *   - {{name}}, {{destination}}, {{price}} 등의 변수를 SMS 템플릿에 삽입
 *   - renderSmsTemplate()가 Contact/Product 정보로 변수 치환
 *   - 변수 누락 시 안전한 기본값 사용 (XSS 방지, 90자 제한)
 *
 * 변수 명명:
 *   - 템플릿 문법: {{변수}} (Handlebars 스타일, 대소문자 구분)
 *   - snake_case 또는 camelCase 모두 허용
 *
 * 사용 예시:
 *   const msg = "안녕하세요 {{name}}님! {{destination}}으로 떠나시는군요. 가격: {{price}}";
 *   const rendered = renderSmsTemplate(msg, { name: "김철수", destination: "부산", price: "39만원" });
 *   // => "안녕하세요 김철수님! 부산으로 떠나시는군요. 가격: 39만원"
 */

import { logger } from "@/lib/logger";

/**
 * SMS 동적 변수 메타데이터
 */
export interface SmsVariable {
  /** 변수 키 ({{key}} 형식) */
  key: string;
  /** 사용자 표시 레이블 */
  label: string;
  /** 필수 여부 (누락 시 경고) */
  required?: boolean;
  /** 변수 타입 */
  type: "string" | "number" | "date";
  /** 기본값 (누락 시 사용) */
  defaultValue?: string;
}

/**
 * Day 0-3에서 사용할 수 있는 변수 정의
 */
export const SMS_VARIABLES_REGISTRY: Record<string, SmsVariable> = {
  name: {
    key: "name",
    label: "고객 이름",
    type: "string",
    defaultValue: "고객님",
    required: false,
  },
  destination: {
    key: "destination",
    label: "여행지",
    type: "string",
    defaultValue: "선택 여행지",
    required: false,
  },
  price: {
    key: "price",
    label: "가격/요금",
    type: "string",
    defaultValue: "정상가",
    required: false,
  },
  discount: {
    key: "discount",
    label: "할인율/할인가",
    type: "string",
    defaultValue: "",
    required: false,
  },
  managerName: {
    key: "managerName",
    label: "담당 매니저 이름",
    type: "string",
    defaultValue: "매니저",
    required: false,
  },
  managerPhone: {
    key: "managerPhone",
    label: "담당 매니저 전화번호",
    type: "string",
    defaultValue: "1800-CRUISE",
    required: false,
  },
  bookingRef: {
    key: "bookingRef",
    label: "예약번호",
    type: "string",
    defaultValue: "",
    required: false,
  },
  departureDate: {
    key: "departureDate",
    label: "출발일",
    type: "date",
    defaultValue: "",
    required: false,
  },
  days: {
    key: "days",
    label: "여행일수",
    type: "number",
    defaultValue: "N일",
    required: false,
  },
  remainingSeats: {
    key: "remainingSeats",
    label: "남은 석수",
    type: "number",
    defaultValue: "석수 정보",
    required: false,
  },
};

/**
 * 변수값 살균 (XSS 방지, 길이 제한)
 *
 * - HTML 특수문자 이스케이프 (< > & " ')
 * - 최대 90자 제한 (SMS 900자 안전 마진)
 * - 줄바꿈 제거 (SMS 한 줄 원칙)
 *
 * @param value 원본 값
 * @returns 살균된 값
 */
export function sanitizeVariable(value: string | null | undefined): string {
  if (!value) return "";

  const str = String(value).trim();

  // 길이 제한
  const truncated = str.length > 90 ? str.substring(0, 87) + "..." : str;

  // HTML 특수문자 이스케이프
  return truncated
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/[\r\n]/g, " "); // 줄바꿈 → 공백
}

/**
 * SMS 템플릿의 변수 검증
 *
 * @param template SMS 템플릿 문자열
 * @param availableVars 사용 가능한 변수명 배열
 * @returns { valid, missing } valid=true이면 모든 변수 정의됨, missing=미정의 변수 목록
 */
export function validateSmsVariables(
  template: string,
  availableVars: string[]
): { valid: boolean; missing: string[] } {
  // {{변수}} 패턴 추출 (정규식: {{ 와 }} 사이의 모든 문자)
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = Array.from(template.matchAll(regex));
  const requiredVars = matches.map((m) => m[1].trim().toLowerCase());
  const uniqueVars = Array.from(new Set(requiredVars));

  // 정규화: snake_case → camelCase 및 소문자 통일
  const normalized = (v: string): string =>
    v.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).toLowerCase();

  const normalizedAvailable = availableVars.map(normalized);
  const missing = uniqueVars.filter(
    (v) => !normalizedAvailable.includes(normalized(v))
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * SMS 템플릿의 {{변수}}를 실제 값으로 치환
 *
 * @param template SMS 템플릿 (예: "안녕하세요 {{name}}님!")
 * @param variables 변수 매핑 (예: { name: "김철수" })
 * @returns 치환된 메시지
 */
export function renderSmsTemplate(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  let result = template;

  // {{변수}} 패턴 치환 (정규식)
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, varKey) => {
    const key = varKey.trim().toLowerCase();
    const value = variables[key] || variables[varKey.trim()]; // 원본 케이스도 시도

    if (value === null || value === undefined) {
      // 미정의 변수: 레지스트리에서 기본값 찾기
      const meta = SMS_VARIABLES_REGISTRY[key];
      if (meta?.defaultValue) {
        return sanitizeVariable(meta.defaultValue);
      }
      // 기본값도 없으면 {{변수}} 그대로 유지 (경고 로그)
      logger.warn("[renderSmsTemplate] 미정의 변수", { key, template });
      return match;
    }

    return sanitizeVariable(value);
  });

  return result;
}

/**
 * Contact 객체에서 SMS 변수 추출
 *
 * @param contact Contact 객체
 * @returns 변수 맵 (예: { name: "김철수", bookingRef: "ABC123", ... })
 */
export function getContactVariables(contact: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  bookingRef?: string | null;
  productName?: string | null;
  budgetRange?: string | null;
  departureDate?: Date | null;
}): Record<string, string> {
  return {
    name: contact.name || "고객님",
    email: contact.email || "",
    phone: contact.phone || "",
    bookingRef: contact.bookingRef || "",
    destination: contact.productName || "선택 여행지",
    departureDate: contact.departureDate
      ? contact.departureDate.toISOString().split("T")[0]
      : "",
  };
}

/**
 * Product 객체에서 SMS 변수 추출
 *
 * @param product CruiseProduct 객체
 * @returns 변수 맵 (예: { destination: "부산", days: "3", price: "39만원", ... })
 */
export function getProductVariables(product: {
  packageName?: string | null;
  shipName?: string | null;
  days?: number | null;
  nights?: number | null;
  basePrice?: number | null;
  isDomestic?: boolean;
  isJapan?: boolean;
  isBudget?: boolean;
}): Record<string, string> {
  const destination = product.isDomestic
    ? "국내"
    : product.isJapan
      ? "일본"
      : product.packageName || "크루즈 여행";

  const price = product.basePrice
    ? `${(product.basePrice / 10000).toFixed(0)}만원`
    : "정상가";

  return {
    destination,
    packageName: product.packageName || "",
    shipName: product.shipName || "",
    days: String(product.days || ""),
    nights: String(product.nights || ""),
    price,
  };
}

/**
 * 여러 변수 맵을 병합
 *
 * 우선순위: 뒤쪽 인자가 앞쪽을 덮어씀
 * 예: mergeVariables(contactVars, productVars, customVars)
 *
 * @param vars 변수 맵들
 * @returns 병합된 변수 맵
 */
export function mergeVariables(
  ...vars: Record<string, string | null | undefined>[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const varMap of vars) {
    for (const [key, value] of Object.entries(varMap)) {
      if (value !== null && value !== undefined) {
        result[key] = String(value);
      }
    }
  }

  return result;
}

/**
 * 템플릿과 변수 목록을 받아 최종 메시지 생성 (원원본 + 검증 + 렌더링)
 *
 * @param template SMS 템플릿
 * @param contactVars Contact 변수
 * @param productVars Product 변수 (선택사항)
 * @param customVars 커스텀 변수 (선택사항)
 * @returns { success, message, missing } success=true면 완성된 메시지, missing=미정의 변수 목록
 */
export function buildSmsMessage(
  template: string,
  contactVars: Record<string, string>,
  productVars?: Record<string, string>,
  customVars?: Record<string, string>
): { success: boolean; message: string; missing: string[] } {
  // 모든 변수 병합 (우선순위: customVars > productVars > contactVars)
  const allVars = mergeVariables(contactVars, productVars || {}, customVars || {});

  // 변수 검증
  const validation = validateSmsVariables(template, Object.keys(allVars));

  // 변수 렌더링
  const message = renderSmsTemplate(template, allVars);

  if (!validation.valid) {
    logger.warn("[buildSmsMessage] 미정의 변수 감지", {
      template: template.substring(0, 50),
      missing: validation.missing,
    });
  }

  return {
    success: validation.valid,
    message,
    missing: validation.missing,
  };
}
