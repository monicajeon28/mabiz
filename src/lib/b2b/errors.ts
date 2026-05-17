/**
 * B2B API 통합 에러 클래스
 * 모든 B2B 에러는 이 클래스 기반으로 일관된 응답 생성
 */

export class B2BError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'B2BError';
    Object.setPrototypeOf(this, B2BError.prototype);
  }
}

export class NotFoundError extends B2BError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource}를 찾을 수 없습니다.`);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends B2BError {
  constructor() {
    super('UNAUTHORIZED', 401, '인증이 필요합니다.');
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends B2BError {
  constructor() {
    super('FORBIDDEN', 403, '접근 권한이 없습니다.');
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends B2BError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends B2BError {
  constructor(message: string) {
    super('RATE_LIMIT', 429, message);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ServerError extends B2BError {
  constructor(message: string = '서버 오류가 발생했습니다.') {
    super('SERVER_ERROR', 500, message);
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class ValidationError extends B2BError {
  constructor(message: string) {
    super('INVALID_INPUT', 400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
