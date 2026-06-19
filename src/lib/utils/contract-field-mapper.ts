import {
  ContractInputField,
  CONTACT_INPUT_FIELD_MAPPINGS,
  ContactFieldMapping,
} from "@/lib/types/contract-templates";
import { logger } from "@/lib/logger";

/**
 * 계약서 필드 매퍼 유틸 (Phase 6)
 * Contact 필드 자동 추출, 필드값 검증, 조건부 표시 여부 판단
 *
 * Phase 6 개선사항:
 * - contactFieldName 기반 유연한 추출 (단일 필드명 또는 배열)
 * - 더 견고한 에러 처리 및 타입 안정성
 * - 복잡한 검증 시나리오 지원
 * - 필드 의존성 그래프, 완성도 계산 등 고급 유틸 추가
 */

/**
 * Contact 모델 타입 (Prisma 생성)
 * 필요한 필드만 포함하는 부분 타입
 */
interface ContactFieldSource {
  // 기본 정보
  name?: string | null;
  email?: string | null;
  phone?: string;

  // 개인정보
  birthDate?: Date | null;
  ageInYears?: number | null;
  gender?: string | null;
  maritalStatus?: string | null;
  childrenCount?: number;

  // 여행 관련
  passportNumber?: string | null;
  passportDaysLeft?: number | null;
  cruiseInterest?: string | null;
  cruiseCount?: number;
  lastCruiseDate?: Date | null;
  departureDate?: Date | null;

  // 예약 정보
  bookingRef?: string | null;
  productName?: string | null;
  budgetRange?: string | null;
}

/**
 * 필드 검증 결과
 */
interface FieldValidationResult {
  isValid: boolean;
  value: any;
  error?: string;
}

/**
 * 복합 필드 검증 결과
 */
interface ComplexValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  validValues: Record<string, any>;
}

/**
 * 1. extractContactFieldValue (개선 버전)
 * Contact에서 특정 contactFieldName으로 필드값을 추출합니다.
 * contactFieldName은 Contact 필드명 또는 CONTACT_INPUT_FIELD_MAPPINGS 키입니다.
 *
 * @param contact - Contact 객체
 * @param contactFieldName - Contact 필드명 또는 매핑 키 (예: "name", "email", "birthDate")
 * @returns 추출된 값 또는 undefined
 */
export function extractContactFieldValue(
  contact: ContactFieldSource | Record<string, any> | null | undefined,
  contactFieldName: string | null | undefined
): any {
  // 입력 검증
  if (!contact || !contactFieldName) {
    return undefined;
  }

  // 매핑 정의 조회
  const mapping = CONTACT_INPUT_FIELD_MAPPINGS[contactFieldName];
  if (!mapping) {
    logger.warn(
      `[ContractFieldMapper] Contact field mapping not found: ${contactFieldName}`
    );
    return undefined;
  }

  // Contact 필드 추출
  const contactField = mapping.contactField;
  let value = (contact as any)[contactField];

  // transformer 함수 적용
  if (mapping.transformer && value !== null && value !== undefined) {
    try {
      value = mapping.transformer(value);
    } catch (error) {
      logger.error(
        `[ContractFieldMapper] transformer 에러 (${contactFieldName}):`,
        error
      );
      return undefined;
    }
  }

  return value;
}

/**
 * 구 버전 호환성 함수
 * 기존 코드와의 호환성을 위해 필드 객체를 받는 형식도 지원
 */
export function extractContactFieldValueLegacy(
  field: ContractInputField,
  contact: Record<string, any>
): any {
  return extractContactFieldValue(contact, field.contactFieldName || undefined);
}

/**
 * 2. extractAllContactFieldValues
 * Contact에서 매핑 가능한 모든 필드값을 추출합니다.
 * 결과는 { fieldName: value } 형식의 객체입니다.
 *
 * @param contact - Contact 객체
 * @param fieldNames - 추출할 필드명 배열 (지정하지 않으면 모든 매핑 가능 필드 추출)
 * @returns 추출된 필드값 맵
 */
export function extractAllContactFieldValues(
  contact: ContactFieldSource | Record<string, any> | null | undefined,
  fieldNames?: string[]
): Record<string, any> {
  if (!contact) {
    return {};
  }

  // fieldNames 미지정 시 모든 매핑 가능 필드 사용
  const fieldsToExtract = fieldNames || Object.keys(CONTACT_INPUT_FIELD_MAPPINGS);

  const result: Record<string, any> = {};

  for (const fieldName of fieldsToExtract) {
    const value = extractContactFieldValue(contact, fieldName);
    if (value !== undefined) {
      result[fieldName] = value;
    }
  }

  return result;
}

/**
 * 구 버전 호환성 함수 (오버로드)
 * 입력필드 배열을 받는 형식도 지원
 * 이 함수는 두 가지 방식을 모두 지원합니다:
 * 1. extractAllContactFieldValues(contact, fieldNames) - 신규 방식
 * 2. extractAllContactFieldValuesLegacy(inputFields, contact) - 레거시 방식
 */
export function extractAllContactFieldValuesLegacy(
  inputFields: ContractInputField[],
  contact: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const field of inputFields) {
    const value = extractContactFieldValueLegacy(field, contact);
    if (value !== undefined) {
      result[field.id] = value;
    }
  }

  return result;
}

/**
 * 호환성 함수: 입력필드 배열로부터 Contact 필드 자동 추출
 * 이 함수는 inputFields 배열의 contactFieldName을 사용하여 Contact에서 값을 추출합니다.
 * @param inputFields - ContractInputField 배열 (contactFieldName 포함)
 * @param contact - Contact 객체
 * @returns 추출된 필드값 맵 (fieldId → value)
 */
export function extractContactFieldsFromInputFields(
  inputFields: ContractInputField[],
  contact: Record<string, any> | null | undefined
): Record<string, any> {
  if (!contact) {
    return {};
  }

  const result: Record<string, any> = {};

  for (const field of inputFields) {
    if (field.contactFieldName) {
      const value = extractContactFieldValue(contact, field.contactFieldName);
      if (value !== undefined) {
        result[field.id] = value;
      }
    }
  }

  return result;
}

/**
 * HTML 템플릿에 입력필드값 바인딩
 * {{fieldId}} 플레이스홀더를 실제값으로 치환
 *
 * @param htmlContent - 원본 HTML ({{fieldId}} 플레이스홀더 포함)
 * @param fieldValues - Record<필드ID, 값>
 * @returns 바인딩된 HTML
 */
export function bindFieldValuesToHtml(
  htmlContent: string,
  fieldValues: Record<string, any>
): string {
  let result = htmlContent;

  for (const [fieldId, value] of Object.entries(fieldValues)) {
    if (value !== null && value !== undefined) {
      const placeholder = new RegExp(`{{${fieldId}}}`, "g");
      result = result.replace(placeholder, String(value));
    }
  }

  return result;
}

/**
 * 3. validateFieldValue (개선 버전)
 * 단일 필드값을 검증합니다.
 * 필드 정의의 required, minLength, maxLength, pattern 규칙을 적용합니다.
 *
 * @param field - 필드 정의
 * @param value - 검증할 값
 * @returns 검증 결과
 */
export function validateFieldValue(
  field: ContractInputField,
  value: any
): FieldValidationResult {
  // null/undefined 처리
  if (value === null || value === undefined) {
    if (field.required) {
      return {
        isValid: false,
        value: value,
        error: `필수 필드입니다 (${field.label})`,
      };
    }
    return { isValid: true, value: null };
  }

  // 타입별 검증
  switch (field.type) {
    case "text": {
      // 문자열 강제 변환
      const stringValue = String(value).trim();

      // 공백만 있는 경우 필수 체크
      if (field.required && stringValue.length === 0) {
        return {
          isValid: false,
          value: stringValue,
          error: `필수 필드입니다 (${field.label})`,
        };
      }

      // 빈 문자열이면 필수 아닐 시 통과
      if (stringValue.length === 0) {
        return { isValid: true, value: stringValue };
      }

      // 최소 길이
      if (field.minLength && stringValue.length < field.minLength) {
        return {
          isValid: false,
          value: stringValue,
          error: `최소 ${field.minLength}자 이상이어야 합니다 (${field.label})`,
        };
      }

      // 최대 길이
      if (field.maxLength && stringValue.length > field.maxLength) {
        return {
          isValid: false,
          value: stringValue,
          error: `최대 ${field.maxLength}자 이하여야 합니다 (${field.label})`,
        };
      }

      // 정규식 패턴
      if (field.pattern) {
        try {
          const regex = new RegExp(field.pattern);
          if (!regex.test(stringValue)) {
            return {
              isValid: false,
              value: stringValue,
              error:
                field.patternError || `올바른 형식이 아닙니다 (${field.label})`,
            };
          }
        } catch (error) {
          logger.error(
            `[ContractFieldMapper] 정규식 에러 (${field.id}):`,
            error
          );
        }
      }

      return { isValid: true, value: stringValue };
    }

    case "checkbox": {
      // 부울값 강제 변환
      const boolValue =
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1" ||
        value === "on";
      return { isValid: true, value: boolValue };
    }

    case "date": {
      // 날짜 검증
      let dateValue: Date | null = null;

      if (value instanceof Date) {
        dateValue = value;
      } else if (typeof value === "string") {
        // ISO 8601 형식 문자열 (YYYY-MM-DD)
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          dateValue = parsed;
        }
      }

      if (!dateValue) {
        return {
          isValid: false,
          value: value,
          error: `올바른 날짜 형식이 아닙니다 (${field.label})`,
        };
      }

      // ISO 문자열 반환 (YYYY-MM-DD)
      const isoString = dateValue.toISOString().split("T")[0];
      return { isValid: true, value: isoString };
    }

    case "email": {
      // 이메일 검증
      const stringValue = String(value).trim();

      if (field.required && stringValue.length === 0) {
        return {
          isValid: false,
          value: stringValue,
          error: `필수 필드입니다 (${field.label})`,
        };
      }

      if (stringValue.length === 0) {
        return { isValid: true, value: stringValue };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(stringValue)) {
        return {
          isValid: false,
          value: stringValue,
          error: `유효한 이메일 형식이 아닙니다 (${field.label})`,
        };
      }

      return { isValid: true, value: stringValue };
    }

    case "phone": {
      // 전화번호 검증
      const stringValue = String(value).trim();

      if (field.required && stringValue.length === 0) {
        return {
          isValid: false,
          value: stringValue,
          error: `필수 필드입니다 (${field.label})`,
        };
      }

      if (stringValue.length === 0) {
        return { isValid: true, value: stringValue };
      }

      const phoneRegex = /^01[0-9][-]?\d{3,4}[-]?\d{4}$/;
      if (!phoneRegex.test(stringValue)) {
        return {
          isValid: false,
          value: stringValue,
          error: `올바른 전화번호 형식이 아닙니다. 010-0000-0000 형식으로 입력하세요 (${field.label})`,
        };
      }

      return { isValid: true, value: stringValue };
    }

    case "number": {
      // 숫자 검증
      const stringValue = String(value).trim();

      if (field.required && stringValue.length === 0) {
        return {
          isValid: false,
          value: stringValue,
          error: `필수 필드입니다 (${field.label})`,
        };
      }

      if (stringValue.length === 0) {
        return { isValid: true, value: stringValue };
      }

      if (isNaN(Number(stringValue))) {
        return {
          isValid: false,
          value: stringValue,
          error: `숫자를 입력해주세요 (${field.label})`,
        };
      }

      return { isValid: true, value: Number(stringValue) };
    }

    case "dropdown": {
      // 드롭다운 옵션 검증
      const stringValue = String(value);

      if (field.required && stringValue.length === 0) {
        return {
          isValid: false,
          value: stringValue,
          error: `필수 필드입니다 (${field.label})`,
        };
      }

      if (!field.options || field.options.length === 0) {
        logger.warn(
          `[ContractFieldMapper] 드롭다운 옵션이 없습니다 (${field.id})`
        );
        return { isValid: true, value: stringValue };
      }

      const isValidOption = field.options.some((opt) => opt.value === stringValue);
      if (!isValidOption) {
        return {
          isValid: false,
          value: stringValue,
          error: `유효하지 않은 선택지입니다 (${field.label})`,
        };
      }

      return { isValid: true, value: stringValue };
    }

    default:
      return { isValid: true, value: value };
  }
}

/**
 * 구 버전 호환성 함수
 * 이전 반환 형식 { valid, error } 호환성
 */
export function validateFieldValueLegacy(
  field: ContractInputField,
  value: any
): { valid: boolean; error?: string } {
  const result = validateFieldValue(field, value);
  return { valid: result.isValid, error: result.error };
}

/**
 * 4. validateAllFieldValues (개선 버전)
 * 모든 필드값을 검증합니다.
 * 검증 실패한 필드들의 에러 메시지를 수집합니다.
 *
 * @param fields - 필드 정의 배열
 * @param values - 검증할 필드값 맵
 * @returns 복합 검증 결과 (에러 및 유효 값)
 */
export function validateAllFieldValues(
  fields: ContractInputField[],
  values: Record<string, any>
): ComplexValidationResult {
  const errors: Record<string, string> = {};
  const validValues: Record<string, any> = {};

  for (const field of fields) {
    const value = values[field.id];
    const result = validateFieldValue(field, value);

    if (!result.isValid) {
      errors[field.id] = result.error || "검증 실패";
    } else {
      validValues[field.id] = result.value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    validValues,
  };
}

/**
 * 구 버전 호환성 함수
 * 이전 반환 형식 { valid, errors } 호환성
 */
export function validateAllFieldValuesLegacy(
  inputFields: ContractInputField[],
  fieldValues: Record<string, any>
): { valid: boolean; errors: Record<string, string> } {
  const result = validateAllFieldValues(inputFields, fieldValues);
  return {
    valid: result.isValid,
    errors: result.errors,
  };
}


/**
 * 5. shouldShowField (개선 버전)
 * visibilityCondition 기반으로 필드 표시 여부를 판단합니다.
 * 조건 필드의 값이 지정된 값과 일치하면 true를 반환합니다.
 *
 * @param field - 필드 정의
 * @param allValues - 모든 필드값 맵
 * @returns 필드 표시 여부
 */
export function shouldShowField(
  field: ContractInputField,
  allValues: Record<string, any>
): boolean {
  // visibilityCondition이 없으면 항상 표시
  if (!field.visibilityCondition) {
    return true;
  }

  const { fieldId, value } = field.visibilityCondition;

  // 조건 필드값 조회
  const conditionValue = allValues[fieldId];

  // 비교 로직
  if (value === true || value === false) {
    // 부울 비교
    return conditionValue === value;
  } else {
    // 문자열/숫자 비교
    return String(conditionValue) === String(value);
  }
}

/**
 * 6. filterVisibleFields (개선 버전)
 * 표시 가능한 필드만 필터링합니다.
 * visibilityCondition을 평가하여 조건을 만족하는 필드만 반환합니다.
 *
 * @param fields - 필드 정의 배열
 * @param allValues - 모든 필드값 맵
 * @returns 표시 가능한 필드 배열
 */
export function filterVisibleFields(
  fields: ContractInputField[],
  allValues: Record<string, any>
): ContractInputField[] {
  return fields.filter((field) => shouldShowField(field, allValues));
}

/**
 * 헬퍼: Contact 필드를 ContractInputField로 자동 바인딩
 * Contact의 매핑 가능한 필드를 템플릿의 inputFields와 병합합니다.
 *
 * @param fields - 템플릿의 inputFields
 * @param contact - Contact 객체
 * @returns 자동 바인딩된 values 맵
 */
export function autoBindContactFields(
  fields: ContractInputField[],
  contact: ContactFieldSource | Record<string, any> | null | undefined
): Record<string, any> {
  if (!contact) {
    return {};
  }

  const result: Record<string, any> = {};

  for (const field of fields) {
    // contactFieldName이 있고 Contact에 매핑되는 경우만 처리
    if (field.contactFieldName) {
      const value = extractContactFieldValue(contact, field.contactFieldName);
      if (value !== undefined) {
        result[field.id] = value;
      }
    }
  }

  return result;
}

/**
 * 헬퍼: 필드 정렬 (order 속성 기반)
 * 템플릿의 inputFields를 order 순서대로 정렬합니다.
 *
 * @param fields - 필드 배열
 * @returns 정렬된 필드 배열
 */
export function sortFieldsByOrder(
  fields: ContractInputField[]
): ContractInputField[] {
  return [...fields].sort((a, b) => a.order - b.order);
}

/**
 * 헬퍼: 필드 그룹화
 * 필드를 순서대로 그룹화합니다 (섹션별 렌더링용).
 * 인접한 필드들을 논리적 그룹으로 묶습니다.
 *
 * @param fields - 정렬된 필드 배열
 * @param groupSize - 그룹당 필드 수 (기본: 5개)
 * @returns 그룹화된 필드 배열의 배열
 */
export function groupFieldsByOrder(
  fields: ContractInputField[],
  groupSize: number = 5
): ContractInputField[][] {
  const groups: ContractInputField[][] = [];

  for (let i = 0; i < fields.length; i += groupSize) {
    groups.push(fields.slice(i, i + groupSize));
  }

  return groups;
}

/**
 * 헬퍼: 필드 검색
 * 필드ID 또는 라벨로 필드를 검색합니다.
 *
 * @param fields - 필드 배열
 * @param searchTerm - 검색어 (ID 또는 라벨)
 * @returns 일치하는 필드 또는 undefined
 */
export function findField(
  fields: ContractInputField[],
  searchTerm: string
): ContractInputField | undefined {
  return fields.find(
    (field) =>
      field.id === searchTerm ||
      field.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

/**
 * 헬퍼: 필드 의존성 그래프 생성
 * visibilityCondition 관계를 매핑하여 필드 간 의존성을 파악합니다.
 * 반환값: { fieldId: [dependentFieldIds...] }
 * 예: { "memberType": ["familySize", "childrenAges"] }
 *
 * @param fields - 필드 배열
 * @returns 의존성 맵
 */
export function buildFieldDependencyGraph(
  fields: ContractInputField[]
): Record<string, string[]> {
  const dependencies: Record<string, string[]> = {};

  for (const field of fields) {
    // 각 필드별 초기화
    if (!dependencies[field.id]) {
      dependencies[field.id] = [];
    }

    // visibilityCondition이 있으면 의존성 기록
    if (field.visibilityCondition) {
      const { fieldId } = field.visibilityCondition;
      if (!dependencies[fieldId]) {
        dependencies[fieldId] = [];
      }
      dependencies[fieldId].push(field.id);
    }
  }

  return dependencies;
}

/**
 * 헬퍼: 계약서 작성 진행률 계산
 * 모든 필수 필드가 채워졌는지 확인하여 완성도를 계산합니다.
 *
 * @param fields - 필드 배열
 * @param values - 필드값 맵
 * @param visibleOnly - 표시 가능한 필드만 계산 여부
 * @returns 완성도 (0-100%)
 */
export function calculateFormCompleteness(
  fields: ContractInputField[],
  values: Record<string, any>,
  visibleOnly: boolean = true
): number {
  // 계산할 필드 결정
  const fieldsToCheck = visibleOnly
    ? filterVisibleFields(fields, values)
    : fields;

  if (fieldsToCheck.length === 0) {
    return 100;
  }

  // 필수 필드만 계산
  const requiredFields = fieldsToCheck.filter((f) => f.required);
  if (requiredFields.length === 0) {
    return 100;
  }

  // 채워진 필수 필드 수
  const filledRequired = requiredFields.filter((f) => {
    const value = values[f.id];
    return value !== null && value !== undefined && value !== "";
  }).length;

  // 백분율 계산
  return Math.round((filledRequired / requiredFields.length) * 100);
}

/**
 * 헬퍼: 마지막 검증 통과 필드 추적
 * 어떤 필드까지 유효한지 추적하여 다단계 폼 UX를 지원합니다.
 *
 * @param fields - 필드 배열
 * @param values - 필드값 맵
 * @returns 마지막 검증 통과 필드 인덱스 (-1이면 모두 실패)
 */
export function findLastValidFieldIndex(
  fields: ContractInputField[],
  values: Record<string, any>
): number {
  let lastValidIndex = -1;

  for (let i = 0; i < fields.length; i++) {
    const result = validateFieldValue(fields[i], values[fields[i].id]);
    if (result.isValid) {
      lastValidIndex = i;
    } else {
      break; // 첫 실패 지점에서 중단
    }
  }

  return lastValidIndex;
}

/**
 * Contact 필드 자동 매핑 가능 여부 확인
 * @param contactFieldName - Contact 필드명
 * @returns 매핑 가능 여부
 */
export function isContactFieldMappable(
  contactFieldName: string | null | undefined
): boolean {
  if (!contactFieldName) {
    return false;
  }

  return contactFieldName in CONTACT_INPUT_FIELD_MAPPINGS;
}
