import { NextResponse } from 'next/server';
import type { ApiErrorResponse } from '@/types/api';
import { logger } from '@/lib/logger';

/** 성공 응답 */
export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/** 검증 에러 응답 */
export function errorResponse(
  message: string,
  status: number = 400,
  options?: {
    error?: string;
    errors?: Record<string, string>;
    details?: unknown;
  }
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: options?.error,
      message,
      errors: options?.errors,
      details: options?.details,
    },
    { status }
  );
}

/** 에러 응답 */
export function fail(message: string, status: number, error?: string) {
  return NextResponse.json({ ok: false, error: error ?? httpErrorCode(status), message }, { status });
}

/** 401 미인증 */
export function unauthorized(message = '인증이 필요합니다') {
  return fail(message, 401, 'UNAUTHORIZED');
}

/** 403 권한 부족 */
export function forbidden(message = '이 작업을 수행할 권한이 없습니다') {
  return fail(message, 403, 'FORBIDDEN');
}

/** 404 리소스 미존재 */
export function notFound(message = '리소스를 찾을 수 없습니다') {
  return fail(message, 404, 'NOT_FOUND');
}

/** 400 검증 실패 */
export function badRequest(message: string) {
  return fail(message, 400, 'INVALID_INPUT');
}

/** 500 서버 에러 */
export function serverError(message = '서버 오류가 발생했습니다') {
  return fail(message, 500, 'INTERNAL_ERROR');
}

/**
 * API catch 블록 공통 에러 핸들러
 * UNAUTHORIZED / FREE_SALES_NO_ACCESS → 401/403 반환 (500 방지)
 */
export function handleApiError(err: unknown, context?: string): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg === 'UNAUTHORIZED' || msg === 'SESSION_REQUIRED') {
    return unauthorized();
  }
  if (msg === 'FREE_SALES_NO_ACCESS' || msg === 'FORBIDDEN') {
    return forbidden();
  }
  if (msg === 'ORGANIZATION_REQUIRED') {
    return forbidden('조직 설정이 필요합니다');
  }
  if (context) {
    logger.error(`[${context}]`, { error: err instanceof Error ? err.message : String(err) });
  }
  return NextResponse.json({ ok: false }, { status: 500 });
}

function httpErrorCode(status: number): string {
  switch (status) {
    case 400: return 'INVALID_INPUT';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    default: return 'INTERNAL_ERROR';
  }
}
