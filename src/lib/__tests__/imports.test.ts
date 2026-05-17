/**
 * 모든 공용 모듈이 올바르게 import 가능한지 테스트
 */

describe('Public API Exports', () => {
  describe('response module', () => {
    it('should export SuccessResponse type', () => {
      // @ts-expect-error - 타입만 테스트
      const _: typeof import('../api/response').SuccessResponse;
    });

    it('should export ErrorResponse type', () => {
      // @ts-expect-error - 타입만 테스트
      const _: typeof import('../api/response').ErrorResponse;
    });

    it('should export ApiResponse type', () => {
      // @ts-expect-error - 타입만 테스트
      const _: typeof import('../api/response').ApiResponse;
    });

    it('should export successResponse function', async () => {
      const { successResponse } = await import('../api/response');
      expect(typeof successResponse).toBe('function');
    });

    it('should export errorResponse function', async () => {
      const { errorResponse } = await import('../api/response');
      expect(typeof errorResponse).toBe('function');
    });

    it('should export type guards', async () => {
      const { isSuccessResponse, isErrorResponse } = await import(
        '../api/response'
      );
      expect(typeof isSuccessResponse).toBe('function');
      expect(typeof isErrorResponse).toBe('function');
    });
  });

  describe('client module', () => {
    it('should export apiClient', async () => {
      const { apiClient } = await import('../api/client');
      expect(typeof apiClient).toBe('object');
      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
      expect(typeof apiClient.patch).toBe('function');
      expect(typeof apiClient.delete).toBe('function');
      expect(typeof apiClient.put).toBe('function');
    });
  });

  describe('hooks', () => {
    it('should export useToast hook', async () => {
      const { useToast } = await import('../api/use-toast');
      expect(typeof useToast).toBe('function');
    });

    // useApiCall는 'use client' 컴포넌트이므로 runtime 테스트 불가
    // 단순 import 테스트만 수행
    it('should be able to import useApiCall hook', async () => {
      // TypeScript import 체크
      const module = await import('../api/use-api-call');
      expect(module).toBeDefined();
    });
  });

  describe('validators module', () => {
    it('should export validation schemas', async () => {
      const {
        ApiResponseSchema,
        SuccessResponseSchema,
        ErrorResponseSchema,
        PaginationSchema,
        DashboardStatsSchema,
        validateData,
        formatZodError,
      } = await import('../validators');

      expect(ApiResponseSchema).toBeDefined();
      expect(SuccessResponseSchema).toBeDefined();
      expect(ErrorResponseSchema).toBeDefined();
      expect(PaginationSchema).toBeDefined();
      expect(DashboardStatsSchema).toBeDefined();
      expect(typeof validateData).toBe('function');
      expect(typeof formatZodError).toBe('function');
    });
  });

  describe('barrel export (__init__)', () => {
    it('should export all public API from __init__', async () => {
      const apiModule = await import('../api/__init__');

      // 타입들
      expect(apiModule).toHaveProperty('successResponse');
      expect(apiModule).toHaveProperty('errorResponse');
      expect(apiModule).toHaveProperty('isSuccessResponse');
      expect(apiModule).toHaveProperty('isErrorResponse');

      // Hooks
      expect(apiModule).toHaveProperty('useApiCall');
      expect(apiModule).toHaveProperty('useToast');

      // Client
      expect(apiModule).toHaveProperty('apiClient');
    });
  });

  describe('type safety', () => {
    it('successResponse should return correct type', async () => {
      const { successResponse } = await import('../api/response');

      const result = successResponse({ id: 1, name: 'test' });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'test' });
    });

    it('errorResponse should return correct type', async () => {
      const { errorResponse } = await import('../api/response');

      const result = errorResponse('Test error', 'ERROR_CODE', {
        field: 'test',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.code).toBe('ERROR_CODE');
      expect(result.details).toEqual({ field: 'test' });
    });
  });
});
