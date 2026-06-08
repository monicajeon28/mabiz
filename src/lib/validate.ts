import { z } from 'zod';

// ─────────────────────────────────────────────
// 검증 헬퍼 함수
// ─────────────────────────────────────────────

/**
 * Zod 스키마를 이용해 데이터를 검증하고 결과를 반환합니다.
 *
 * @param schema - Zod 스키마
 * @param data - 검증할 데이터
 * @returns { success: boolean, data?: T, errors?: Record<string, string> }
 *
 * @example
 * const result = validateFormData(CreateContactSchema, formData);
 * if (result.success) {
 *   await saveContact(result.data);
 * } else {
 *   console.error(result.errors); // { name: "이름은 필수입니다." }
 * }
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  // 에러를 { fieldName: "에러메시지" } 형식으로 변환
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return { success: false, errors };
}

/**
 * Zod 스키마를 이용해 배열 데이터를 검증합니다.
 *
 * @param itemSchema - 각 아이템의 Zod 스키마
 * @param items - 검증할 배열
 * @returns { success: boolean, data?: T[], errors?: Record<number, Record<string, string>> }
 *
 * @example
 * const result = validateFormDataArray(SmsRecipientSchema, recipients);
 * if (!result.success) {
 *   console.error(result.errors[0]); // { phone: "전화번호 형식이 잘못되었습니다." }
 * }
 */
export function validateFormDataArray<T>(
  itemSchema: z.ZodSchema<T>,
  items: unknown[]
): {
  success: boolean;
  data?: T[];
  errors?: Record<number, Record<string, string>>;
} {
  const errors: Record<number, Record<string, string>> = {};
  const validatedItems: T[] = [];

  for (let i = 0; i < items.length; i++) {
    const parsed = itemSchema.safeParse(items[i]);

    if (parsed.success) {
      validatedItems.push(parsed.data);
    } else {
      const itemErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        itemErrors[path] = issue.message;
      }
      errors[i] = itemErrors;
    }
  }

  if (Object.keys(errors).length === 0) {
    return { success: true, data: validatedItems };
  }

  return { success: false, errors };
}

/**
 * 검증 에러를 사용자 친화적인 메시지로 변환합니다.
 *
 * @param errors - validateFormData에서 반환한 errors 객체
 * @returns string - 합쳐진 에러 메시지 (줄바꿈으로 구분)
 *
 * @example
 * const result = validateFormData(schema, data);
 * if (!result.success) {
 *   const message = formatErrorMessage(result.errors);
 *   toast.error(message);
 * }
 */
export function formatErrorMessage(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([field, message]) => message)
    .join('\n');
}

/**
 * 중첩된 객체의 특정 경로에서 에러를 찾습니다.
 *
 * @param errors - validateFormData에서 반환한 errors 객체
 * @param path - 찾을 경로 (예: "contact.phone")
 * @returns string | undefined - 해당 경로의 에러 메시지
 *
 * @example
 * const phoneError = getFieldError(errors, 'phone');
 * const contactNameError = getFieldError(errors, 'contact.name');
 */
export function getFieldError(
  errors: Record<string, string> | undefined,
  path: string
): string | undefined {
  if (!errors) return undefined;
  return errors[path];
}

/**
 * 특정 필드가 검증 에러를 가지고 있는지 확인합니다.
 *
 * @param errors - validateFormData에서 반환한 errors 객체
 * @param path - 확인할 필드 경로
 * @returns boolean
 *
 * @example
 * if (hasFieldError(errors, 'phone')) {
 *   inputRef.current?.focus();
 * }
 */
export function hasFieldError(
  errors: Record<string, string> | undefined,
  path: string
): boolean {
  if (!errors) return false;
  return path in errors;
}

/**
 * 특정 필드의 검증 상태를 나타내는 CSS 클래스를 반환합니다.
 *
 * @param errors - validateFormData에서 반환한 errors 객체
 * @param path - 확인할 필드 경로
 * @returns string - CSS 클래스 이름
 *
 * @example
 * <input className={getFieldClassName(errors, 'phone')} />
 * // hasError → "border-red-500"
 * // success → "border-green-500"
 * // default → ""
 */
export function getFieldClassName(
  errors: Record<string, string> | undefined,
  path: string
): string {
  if (!errors) return '';
  if (path in errors) return 'border-red-500';
  return '';
}

/**
 * 폼 제출 전에 빠른 유효성 검사를 수행합니다.
 * 필수 필드만 확인하는 경량 검증입니다.
 *
 * @param schema - Zod 스키마
 * @param data - 검증할 데이터
 * @returns { isValid: boolean, firstError?: string }
 *
 * @example
 * const validation = quickValidate(CreateContactSchema, formData);
 * if (!validation.isValid) {
 *   toast.error(validation.firstError);
 *   return;
 * }
 */
export function quickValidate(
  schema: z.ZodSchema,
  data: unknown
): {
  isValid: boolean;
  firstError?: string;
} {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    return { isValid: true };
  }

  const firstError = parsed.error.issues[0]?.message;
  return { isValid: false, firstError };
}
