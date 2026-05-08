import { NextResponse } from 'next/server';

/** 성공 응답 */
export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
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

function httpErrorCode(status: number): string {
  switch (status) {
    case 400: return 'INVALID_INPUT';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    default: return 'INTERNAL_ERROR';
  }
}
