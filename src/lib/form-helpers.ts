import { useForm, UseFormProps, FieldValues, UseFormRegister, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// ─────────────────────────────────────────────
// React Hook Form + Zod 통합 헬퍼
// ─────────────────────────────────────────────

/**
 * Zod 스키마를 이용한 useForm 설정 생성
 *
 * @param schema - Zod 스키마
 * @param options - useForm의 추가 옵션
 * @returns useForm 설정 객체
 *
 * @example
 * type ContactFormInputs = z.infer<typeof CreateContactSchema>;
 * const form = useForm(createFormConfig(CreateContactSchema, {
 *   defaultValues: { name: '', phone: '' }
 * }));
 */
export function createFormConfig<T extends z.ZodSchema<FieldValues>>(
  schema: T,
  options?: UseFormProps<z.infer<T>>
): UseFormProps<z.infer<T>> {
  return {
    resolver: zodResolver(schema as any),
    mode: 'onBlur',
    ...options,
  };
}

/**
 * 폼 필드의 검증 상태 클래스를 반환합니다.
 *
 * @param isError - 에러 여부
 * @param isDirty - 수정 여부
 * @param baseClass - 기본 클래스
 * @returns string - CSS 클래스
 *
 * @example
 * <input className={getInputFieldClass(!!errors.phone, isDirty('phone'))} />
 */
export function getInputFieldClass(
  isError: boolean,
  isDirty?: boolean,
  baseClass: string = 'border rounded px-3 py-2 text-sm'
): string {
  if (isError) {
    return `${baseClass} border-red-500 focus:ring-red-200`;
  }
  if (isDirty) {
    return `${baseClass} border-green-500 focus:ring-green-200`;
  }
  return `${baseClass} border-gray-300`;
}

/**
 * 폼 필드에 대한 완전한 설정을 반환합니다 (register + error + className)
 *
 * @param register - useForm의 register 함수
 * @param fieldName - 필드 이름
 * @param errors - formState.errors 객체
 * @param isDirty - 수정 여부 함수
 * @param baseClass - 기본 CSS 클래스
 * @returns { register: {...}, error?: string, className: string }
 *
 * @example
 * const phoneField = getFieldConfig(register, 'phone', errors, (f) => dirtyFields[f]);
 * <input {...phoneField.register} className={phoneField.className} />
 * {phoneField.error && <span className="text-red-500">{phoneField.error}</span>}
 */
export function getFieldConfig<T extends FieldValues>(
  register: UseFormRegister<T>,
  fieldName: keyof T,
  errors: FieldErrors<T>,
  isDirtyCheck?: (field: string) => boolean,
  baseClass?: string
) {
  const fieldPath = String(fieldName);
  const fieldError = errors[fieldPath];
  const isDirty = isDirtyCheck?.(fieldPath);

  return {
    register: register(fieldPath as any),
    error: fieldError?.message,
    className: getInputFieldClass(!!fieldError, isDirty, baseClass),
  };
}

/**
 * 폼 제출 핸들러 생성기
 *
 * @param onValidSubmit - 검증 성공 시 실행할 핸들러
 * @param onError - 검증 실패 시 실행할 핸들러 (선택)
 * @returns 폼 제출 핸들러 함수
 *
 * @example
 * const form = useForm<CreateContactInput>({...});
 * const onSubmit = createSubmitHandler(
 *   async (data) => {
 *     await saveContact(data);
 *     toast.success('저장되었습니다');
 *   },
 *   (errors) => {
 *     console.error('Validation failed:', errors);
 *   }
 * );
 * <form onSubmit={form.handleSubmit(onSubmit)}>
 */
export function createSubmitHandler<T extends FieldValues>(
  onValidSubmit: (data: T) => Promise<void> | void,
  onError?: (errors: FieldErrors<T>) => void
) {
  return async (data: T) => {
    try {
      await onValidSubmit(data);
    } catch (error) {
      console.error('Submit error:', error);
      throw error;
    }
  };
}

/**
 * 폼 필드들의 에러를 한 번에 확인합니다.
 *
 * @param errors - formState.errors 객체
 * @param fields - 확인할 필드명 배열
 * @returns boolean - 에러가 있으면 true
 *
 * @example
 * if (hasAnyError(errors, ['name', 'phone', 'email'])) {
 *   setIsSubmitDisabled(true);
 * }
 */
export function hasAnyError(
  errors: Record<string, any>,
  fields: string[]
): boolean {
  return fields.some(field => field in errors);
}

/**
 * 폼 에러를 사용자 친화적인 메시지로 변환합니다.
 *
 * @param errors - formState.errors 객체
 * @returns string - 합쳐진 에러 메시지
 *
 * @example
 * const message = formatFormErrors(errors);
 * toast.error(message);
 */
export function formatFormErrors(errors: Record<string, any>): string {
  return Object.entries(errors)
    .map(([_, error]: [string, any]) => error?.message || '알 수 없는 오류가 발생했습니다.')
    .join('\n');
}

/**
 * 폼 데이터를 객체로 변환하고 검증합니다.
 *
 * @param formData - FormData 객체
 * @param fieldNames - 추출할 필드명 배열
 * @returns Record<string, any> - 변환된 객체
 *
 * @example
 * const formElement = formRef.current;
 * if (formElement) {
 *   const data = formDataToObject(
 *     new FormData(formElement),
 *     ['name', 'phone', 'email']
 *   );
 * }
 */
export function formDataToObject(
  formData: FormData,
  fieldNames: string[]
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const field of fieldNames) {
    const value = formData.get(field);
    result[field] = value;
  }

  return result;
}

/**
 * 특정 필드의 에러 메시지를 안전하게 가져옵니다.
 *
 * @param errors - formState.errors 객체
 * @param path - 필드 경로 (중첩 가능)
 * @returns string | undefined - 에러 메시지
 *
 * @example
 * const error = getErrorMessage(errors, 'phone');
 * const nestedError = getErrorMessage(errors, 'contact.address.phone');
 */
export function getErrorMessage(
  errors: Record<string, any>,
  path: string
): string | undefined {
  const keys = path.split('.');
  let current = errors;

  for (const key of keys) {
    if (current[key]) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current?.message;
}

/**
 * 폼의 모든 필드를 리셋합니다.
 *
 * @param form - useForm 반환 객체
 * @param defaultValues - 리셋할 기본값
 *
 * @example
 * const form = useForm<CreateContactInput>({...});
 * const handleReset = () => resetForm(form, { name: '', phone: '' });
 */
export function resetForm<T extends FieldValues>(
  form: ReturnType<typeof useForm<T>>,
  defaultValues?: Partial<T>
) {
  form.reset(defaultValues as any);
}

/**
 * 특정 필드를 리셋합니다.
 *
 * @param form - useForm 반환 객체
 * @param fields - 리셋할 필드명 배열
 *
 * @example
 * resetFields(form, ['phone', 'email']);
 */
export function resetFields<T extends FieldValues>(
  form: ReturnType<typeof useForm<T>>,
  fields: (keyof T)[]
) {
  fields.forEach(field => {
    form.resetField(String(field) as any);
  });
}

/**
 * 폼 데이터를 검증하고 제출합니다 (수동 검증용)
 *
 * @param data - 검증할 데이터
 * @param schema - Zod 스키마
 * @param onSuccess - 성공 핸들러
 * @param onError - 에러 핸들러
 *
 * @example
 * const handleSubmit = async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   await validateAndSubmit(
 *     { name: 'John', phone: '010-1234-5678' },
 *     CreateContactSchema,
 *     (data) => saveContact(data),
 *     (errors) => showErrors(errors)
 *   );
 * };
 */
export async function validateAndSubmit<T extends FieldValues>(
  data: unknown,
  schema: z.ZodSchema<T>,
  onSuccess: (data: T) => Promise<void> | void,
  onError: (errors: Record<string, string>) => void
) {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    await onSuccess(parsed.data);
  } else {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    }
    onError(errors);
  }
}
