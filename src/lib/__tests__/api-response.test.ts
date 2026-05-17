/**
 * API 응답 타입 및 헬퍼 테스트
 */

import {
  successResponse,
  errorResponse,
  isSuccessResponse,
  isErrorResponse,
} from '../api/response';
import type { ApiResponse, SuccessResponse, ErrorResponse } from '../api/response';

describe('API Response Helpers', () => {
  describe('successResponse', () => {
    it('should create a success response', () => {
      const data = { id: 1, name: 'Test' };
      const response = successResponse(data);

      expect(response.ok).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should work with generic types', () => {
      interface User {
        id: number;
        email: string;
      }

      const user: User = { id: 1, email: 'test@example.com' };
      const response = successResponse<User>(user);

      expect(response.ok).toBe(true);
      expect(response.data.email).toBe('test@example.com');
    });

    it('should work with arrays', () => {
      const data = [1, 2, 3];
      const response = successResponse(data);

      expect(response.ok).toBe(true);
      expect(response.data).toEqual(data);
    });
  });

  describe('errorResponse', () => {
    it('should create an error response with message only', () => {
      const response = errorResponse('Something went wrong');

      expect(response.ok).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.code).toBeUndefined();
      expect(response.details).toBeUndefined();
    });

    it('should create an error response with code', () => {
      const response = errorResponse('Not found', 'NOT_FOUND');

      expect(response.ok).toBe(false);
      expect(response.error).toBe('Not found');
      expect(response.code).toBe('NOT_FOUND');
    });

    it('should create an error response with details', () => {
      const details = { field: 'email', issue: 'invalid format' };
      const response = errorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        details
      );

      expect(response.ok).toBe(false);
      expect(response.error).toBe('Validation failed');
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.details).toEqual(details);
    });
  });

  describe('Type guards', () => {
    it('should correctly identify success responses', () => {
      const success = successResponse({ data: 'test' });
      const error = errorResponse('error');

      expect(isSuccessResponse(success)).toBe(true);
      expect(isSuccessResponse(error)).toBe(false);
    });

    it('should correctly identify error responses', () => {
      const success = successResponse({ data: 'test' });
      const error = errorResponse('error');

      expect(isErrorResponse(success)).toBe(false);
      expect(isErrorResponse(error)).toBe(true);
    });

    it('should narrow types correctly in if statements', () => {
      const response: ApiResponse<string> = successResponse('hello');

      if (isSuccessResponse(response)) {
        // response.data is available
        const data: string = response.data;
        expect(data).toBe('hello');
      }

      if (isErrorResponse(response)) {
        // This should not execute
        expect(true).toBe(false);
      }
    });
  });

  describe('Response structure compliance', () => {
    it('should always have ok property', () => {
      const success = successResponse({ id: 1 });
      const error = errorResponse('Error');

      expect('ok' in success).toBe(true);
      expect('ok' in error).toBe(true);
    });

    it('success response should have data property', () => {
      const response = successResponse({ test: 'value' });
      expect('data' in response).toBe(true);
    });

    it('error response should have error property', () => {
      const response = errorResponse('Test error');
      expect('error' in response).toBe(true);
    });

    it('error response may have code and details', () => {
      const response = errorResponse(
        'Error',
        'ERROR_CODE',
        { field: 'test' }
      );
      expect('code' in response).toBe(true);
      expect('details' in response).toBe(true);
    });
  });
});
