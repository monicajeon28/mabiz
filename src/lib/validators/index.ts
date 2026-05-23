/**
 * Zod 검증 스키마
 * API 요청/응답 데이터 검증에 사용됩니다.
 */

import { z } from 'zod';

// ===== API 응답 스키마 =====

/**
 * API 응답 기본 스키마
 */
export const ApiResponseSchema = z.object({
  ok: z.boolean(),
});

/**
 * 성공 응답 스키마
 */
export const SuccessResponseSchema = ApiResponseSchema.extend({
  ok: z.literal(true),
  data: z.unknown(),
});

/**
 * 실패 응답 스키마
 */
export const ErrorResponseSchema = ApiResponseSchema.extend({
  ok: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ===== 공통 스키마 =====

/**
 * 페이지네이션 스키마
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().default(20),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

/**
 * 페이지네이션 쿼리 파라미터 스키마
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ===== 대시보드 API 스키마 =====

/**
 * 대시보드 통계 응답 스키마
 */
export const DashboardStatsSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    totalCustomers: z.number().nonnegative(),
    activeDeals: z.number().nonnegative(),
    revenue: z.number().nonnegative(),
    conversionRate: z.number().nonnegative().max(1).optional(),
  }),
});

/**
 * 대시보드 차트 데이터 스키마
 */
export const ChartDataPointSchema = z.object({
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  value: z.number(),
  label: z.string().optional(),
});

export const ChartDataSchema = z.array(ChartDataPointSchema);

// ===== 에러 핸들링 스키마 =====

/**
 * 유효성 검사 에러 응답 스키마
 */
export const ValidationErrorSchema = ErrorResponseSchema.extend({
  details: z
    .object({
      fields: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
});

/**
 * 인증 에러 응답 스키마
 */
export const AuthErrorSchema = ErrorResponseSchema.extend({
  code: z.enum(['UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_EXPIRED']).optional(),
});

// ===== 검증 유틸리티 =====

/**
 * 데이터 검증 함수
 * @param data 검증할 데이터
 * @param schema Zod 스키마
 * @returns 검증 결과 또는 에러
 *
 * @example
 * ```typescript
 * const result = validateData(inputData, PaginationQuerySchema);
 * if (result.ok) {
 *   console.log('Valid:', result.data);
 * } else {
 *   console.error('Invalid:', result.error.message);
 * }
 * ```
 */
export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { ok: true; data: T } | { ok: false; error: z.ZodError } {
  try {
    const validatedData = schema.parse(data);
    return { ok: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error };
    }
    throw error;
  }
}

/**
 * Zod 에러를 사람이 읽을 수 있는 형식으로 변환
 * @param error Zod 에러
 * @returns 에러 메시지
 *
 * @example
 * ```typescript
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     const message = formatZodError(error);
 *     console.error(message);
 *   }
 * }
 * ```
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues;
  if (issues.length === 0) {
    return '검증 실패';
  }

  if (issues.length === 1) {
    const issue = issues[0];
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  }

  const firstIssue = issues[0];
  const firstPath = firstIssue.path.join('.');
  return `${firstPath}: ${firstIssue.message} (외 ${issues.length - 1}개)`;
}
