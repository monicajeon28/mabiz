/**
 * 표준 API 응답 타입 정의
 * 모든 API는 이 형식을 따릅니다.
 */

// 성공 응답
export type SuccessResponse<T> = {
  ok: true;
  data: T;
};

// 실패 응답
export type ErrorResponse = {
  ok: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
};

// 통합 응답 타입
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * 성공 응답 생성 헬퍼
 * @param data 응답 데이터
 * @returns SuccessResponse 객체
 */
export const successResponse = <T,>(data: T): SuccessResponse<T> => ({
  ok: true,
  data,
});

/**
 * 실패 응답 생성 헬퍼
 * @param error 에러 메시지
 * @param code 에러 코드 (선택)
 * @param details 상세 정보 (선택)
 * @returns ErrorResponse 객체
 */
export const errorResponse = (
  error: string,
  code?: string,
  details?: Record<string, any>
): ErrorResponse => ({
  ok: false,
  error,
  code,
  details,
});

/**
 * 응답이 성공인지 확인하는 타입 가드
 * @param response API 응답
 * @returns 성공 여부
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is SuccessResponse<T> {
  return response.ok === true;
}

/**
 * 응답이 실패인지 확인하는 타입 가드
 * @param response API 응답
 * @returns 실패 여부
 */
export function isErrorResponse(
  response: ApiResponse<any>
): response is ErrorResponse {
  return response.ok === false;
}
