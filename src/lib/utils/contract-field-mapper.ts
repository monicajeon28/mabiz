import {
  ContractInputField,
  CONTACT_INPUT_FIELD_MAPPINGS,
  ContactFieldMapping,
} from "@/lib/types/contract-templates";

/**
 * Contact 데이터로부터 ContractInputField 값 자동 추출
 * Contact의 필드값을 ContractInputField의 값으로 변환
 *
 * @param field - 정의된 ContractInputField
 * @param contact - Contact 객체
 * @returns 추출된 값 (또는 null/undefined)
 */
export function extractContactFieldValue(
  field: ContractInputField,
  contact: Record<string, any>
): any {
  // contactFieldName이 없으면 수동 입력만 가능
  if (!field.contactFieldName) {
    return undefined;
  }

  // Contact 필드명으로 매핑 규칙 조회
  const mapping = CONTACT_INPUT_FIELD_MAPPINGS[field.contactFieldName];
  if (!mapping) {
    console.warn(
      `Contact field mapping not found: ${field.contactFieldName}`
    );
    return undefined;
  }

  // Contact에서 값 추출
  const contactValue = contact[mapping.contactField];

  // transformer 함수가 있으면 적용
  if (mapping.transformer) {
    return mapping.transformer(contactValue);
  }

  return contactValue;
}

/**
 * Contact 객체로부터 모든 입력필드값 추출
 * @param inputFields - 정의된 ContractInputField 배열
 * @param contact - Contact 객체
 * @returns Record<필드ID, 값>
 */
export function extractAllContactFieldValues(
  inputFields: ContractInputField[],
  contact: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const field of inputFields) {
    const value = extractContactFieldValue(field, contact);
    if (value !== undefined) {
      result[field.id] = value;
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
 * 입력필드 필수 검증
 * @param field - ContractInputField
 * @param value - 입력값
 * @returns { valid: boolean, error?: string }
 */
export function validateFieldValue(
  field: ContractInputField,
  value: any
): { valid: boolean; error?: string } {
  // 필수 필드 체크
  if (field.required && (!value || value.toString().trim() === "")) {
    return {
      valid: false,
      error: `${field.label}은(는) 필수입니다`,
    };
  }

  // 값이 비어있으면 (필수 아님) 통과
  if (!value || value.toString().trim() === "") {
    return { valid: true };
  }

  // type별 검증
  switch (field.type) {
    case "text": {
      // 최소/최대 길이 체크
      const strValue = String(value);
      if (field.minLength && strValue.length < field.minLength) {
        return {
          valid: false,
          error: `${field.label}은(는) 최소 ${field.minLength}자 이상이어야 합니다`,
        };
      }
      if (field.maxLength && strValue.length > field.maxLength) {
        return {
          valid: false,
          error: `${field.label}은(는) 최대 ${field.maxLength}자 이하여야 합니다`,
        };
      }

      // 정규식 패턴 검증
      if (field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(strValue)) {
          return {
            valid: false,
            error: field.patternError || `${field.label} 형식이 올바르지 않습니다`,
          };
        }
      }
      break;
    }

    case "date": {
      // 유효한 날짜 형식 확인 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const strValue = String(value);
      if (!dateRegex.test(strValue)) {
        return {
          valid: false,
          error: `${field.label}은(는) YYYY-MM-DD 형식이어야 합니다`,
        };
      }

      // 유효한 날짜 여부 확인
      const date = new Date(strValue);
      if (isNaN(date.getTime())) {
        return {
          valid: false,
          error: `${field.label}이(가) 유효한 날짜가 아닙니다`,
        };
      }
      break;
    }

    case "dropdown": {
      // 옵션값 확인
      if (field.options) {
        const validOptions = field.options.map((o) => o.value);
        if (!validOptions.includes(String(value))) {
          return {
            valid: false,
            error: `${field.label}의 선택값이 유효하지 않습니다`,
          };
        }
      }
      break;
    }

    case "checkbox": {
      // boolean 타입 확인
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        return {
          valid: false,
          error: `${field.label}은(는) 체크박스 값이어야 합니다`,
        };
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * 모든 입력필드 검증
 * @param inputFields - ContractInputField 배열
 * @param fieldValues - Record<필드ID, 값>
 * @returns { valid: boolean, errors: Record<필드ID, 에러메시지> }
 */
export function validateAllFieldValues(
  inputFields: ContractInputField[],
  fieldValues: Record<string, any>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of inputFields) {
    const value = fieldValues[field.id];
    const validation = validateFieldValue(field, value);
    if (!validation.valid) {
      errors[field.id] = validation.error || "검증 실패";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * 조건부 표시 여부 판단
 * @param field - ContractInputField
 * @param fieldValues - Record<필드ID, 값>
 * @returns 필드 표시 여부
 */
export function shouldShowField(
  field: ContractInputField,
  fieldValues: Record<string, any>
): boolean {
  // 조건이 없으면 항상 표시
  if (!field.visibilityCondition) {
    return true;
  }

  const { fieldId, value } = field.visibilityCondition;
  const conditionValue = fieldValues[fieldId];

  // 조건값과 비교 (문자열 또는 boolean)
  if (typeof value === "boolean") {
    return conditionValue === value;
  }

  return String(conditionValue) === String(value);
}

/**
 * 표시할 필드만 필터링
 * @param inputFields - ContractInputField 배열
 * @param fieldValues - Record<필드ID, 값>
 * @returns 표시 가능한 필드 배열
 */
export function filterVisibleFields(
  inputFields: ContractInputField[],
  fieldValues: Record<string, any>
): ContractInputField[] {
  return inputFields.filter((field) => shouldShowField(field, fieldValues));
}

/**
 * 입력필드를 order 순서대로 정렬
 * @param inputFields - ContractInputField 배열
 * @returns 정렬된 필드 배열
 */
export function sortFieldsByOrder(
  inputFields: ContractInputField[]
): ContractInputField[] {
  return [...inputFields].sort((a, b) => a.order - b.order);
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

/**
 * 사용 가능한 Contact 필드 목록 반환
 * @returns { fieldName: string, label: string, type: string }[]
 */
export function getAvailableContactFields(): Array<{
  fieldName: string;
  label: string;
  type: string;
}> {
  return Object.entries(CONTACT_INPUT_FIELD_MAPPINGS).map(
    ([fieldName, mapping]) => ({
      fieldName,
      label: mapping.description,
      type: mapping.inputFieldType,
    })
  );
}
