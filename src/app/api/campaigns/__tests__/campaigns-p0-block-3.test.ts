/**
 * P0-BLOCK-3: Promise.allSettled Integration Tests
 * Tests for graceful degradation when parallel queries fail
 */

import { safeParallel, getOrDefault, allFulfilled, countFulfilled, getErrors } from '@/lib/error-handling';

describe('P0-BLOCK-3: safeParallel - Promise.allSettled Implementation', () => {
  describe('safeParallel: Normal Success Path', () => {
    it('should fulfill all promises when all succeed', async () => {
      const results = await safeParallel([
        Promise.resolve('value1'),
        Promise.resolve('value2'),
        Promise.resolve('value3'),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe('value1');
      expect(results[1].status).toBe('fulfilled');
      expect((results[1] as PromiseFulfilledResult<string>).value).toBe('value2');
      expect(results[2].status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe('value3');
    });
  });

  describe('safeParallel: Partial Failure Path', () => {
    it('should handle partial failures gracefully', async () => {
      const results = await safeParallel([
        Promise.resolve('success1'),
        Promise.reject(new Error('Simulated query failure')),
        Promise.resolve('success2'),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe('success1');
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason.message).toBe(
        'Simulated query failure'
      );
      expect(results[2].status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe('success2');
    });

    it('should respect timeout option', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve('slow'), 10000); // 10 second delay
      });

      const results = await safeParallel([slowPromise], {
        timeout: 100, // 100ms timeout
        logging: false,
      });

      expect(results[0].status).toBe('rejected');
      expect((results[0] as PromiseRejectedResult).reason.message).toContain('timed out');
    });

    it('should invoke onError callback for failures', async () => {
      const onErrorMock = jest.fn();

      await safeParallel(
        [
          Promise.resolve('success'),
          Promise.reject(new Error('Error 1')),
          Promise.reject(new Error('Error 2')),
        ],
        { logging: false, onError: onErrorMock }
      );

      expect(onErrorMock).toHaveBeenCalledTimes(2);
      expect(onErrorMock).toHaveBeenCalledWith(1, expect.any(Error));
      expect(onErrorMock).toHaveBeenCalledWith(2, expect.any(Error));
    });
  });

  describe('getOrDefault: Helper Functions', () => {
    it('should return value when fulfilled', () => {
      const result: PromiseSettledResult<number> = {
        status: 'fulfilled',
        value: 42,
      };

      expect(getOrDefault(result, 0)).toBe(42);
    });

    it('should return default when rejected', () => {
      const result: PromiseSettledResult<number> = {
        status: 'rejected',
        reason: new Error('Failed'),
      };

      expect(getOrDefault(result, 0)).toBe(0);
    });

    it('should return default object when rejected', () => {
      const result: PromiseSettledResult<{ count: number }> = {
        status: 'rejected',
        reason: new Error('Query failed'),
      };

      const defaultValue = { count: 0 };
      expect(getOrDefault(result, defaultValue)).toEqual(defaultValue);
    });

    it('should return default array when rejected', () => {
      const result: PromiseSettledResult<string[]> = {
        status: 'rejected',
        reason: new Error('Query failed'),
      };

      expect(getOrDefault(result, [])).toEqual([]);
    });
  });

  describe('Utility Functions: allFulfilled, countFulfilled, getErrors', () => {
    it('allFulfilled should return true when all fulfilled', async () => {
      const results = await safeParallel([
        Promise.resolve('a'),
        Promise.resolve('b'),
        Promise.resolve('c'),
      ]);

      expect(allFulfilled(results)).toBe(true);
    });

    it('allFulfilled should return false when any rejected', async () => {
      const results = await safeParallel([
        Promise.resolve('a'),
        Promise.reject(new Error('Error')),
        Promise.resolve('c'),
      ]);

      expect(allFulfilled(results)).toBe(false);
    });

    it('countFulfilled should return correct count', async () => {
      const results = await safeParallel(
        [
          Promise.resolve('a'),
          Promise.reject(new Error('Error')),
          Promise.resolve('c'),
          Promise.reject(new Error('Error')),
        ],
        { logging: false }
      );

      expect(countFulfilled(results)).toBe(2);
    });

    it('getErrors should return all error objects', async () => {
      const results = await safeParallel(
        [
          Promise.resolve('a'),
          Promise.reject(new Error('Error 1')),
          Promise.resolve('c'),
          Promise.reject(new Error('Error 2')),
        ],
        { logging: false }
      );

      const errors = getErrors(results);
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Error 1');
      expect(errors[1].message).toBe('Error 2');
    });
  });

  describe('Real-world: Database Query Pattern', () => {
    it('should handle count + findMany parallel queries', async () => {
      // Simulate Prisma queries
      const mockCount = () => Promise.resolve(100);
      const mockFindMany = () =>
        Promise.resolve([
          { id: '1', title: 'Campaign 1' },
          { id: '2', title: 'Campaign 2' },
        ]);

      const [countResult, listResult] = await safeParallel([
        mockCount(),
        mockFindMany(),
      ]);

      const total = getOrDefault(countResult, 0);
      const campaigns = getOrDefault(listResult, []);

      expect(total).toBe(100);
      expect(campaigns).toHaveLength(2);
      expect(campaigns[0].title).toBe('Campaign 1');
    });

    it('should handle count failure gracefully', async () => {
      const mockCountFail = () => Promise.reject(new Error('Count query failed'));
      const mockFindMany = () =>
        Promise.resolve([
          { id: '1', title: 'Campaign 1' },
          { id: '2', title: 'Campaign 2' },
        ]);

      const [countResult, listResult] = await safeParallel(
        [mockCountFail(), mockFindMany()],
        { logging: false }
      );

      const total = getOrDefault(countResult, 0); // Default to 0
      const campaigns = getOrDefault(listResult, []);

      // Should return 200 with campaigns but no count
      expect(total).toBe(0);
      expect(campaigns).toHaveLength(2);
      expect(countResult.status).toBe('rejected');
      expect(listResult.status).toBe('fulfilled');
    });

    it('should handle findMany failure gracefully', async () => {
      const mockCount = () => Promise.resolve(100);
      const mockFindManyFail = () => Promise.reject(new Error('List query failed'));

      const [countResult, listResult] = await safeParallel(
        [mockCount(), mockFindManyFail()],
        { logging: false }
      );

      const total = getOrDefault(countResult, 0);
      const campaigns = getOrDefault(listResult, []);

      // Should return 200 with count but no campaigns
      expect(total).toBe(100);
      expect(campaigns).toEqual([]);
      expect(countResult.status).toBe('fulfilled');
      expect(listResult.status).toBe('rejected');
    });

    it('should handle both failures and return 200 with empty data', async () => {
      const mockCountFail = () => Promise.reject(new Error('Count failed'));
      const mockFindManyFail = () => Promise.reject(new Error('List failed'));

      const [countResult, listResult] = await safeParallel(
        [mockCountFail(), mockFindManyFail()],
        { logging: false }
      );

      const total = getOrDefault(countResult, 0);
      const campaigns = getOrDefault(listResult, []);

      // Should return 200 with empty data
      expect(total).toBe(0);
      expect(campaigns).toEqual([]);
      // Both should be rejected
      expect(countResult.status).toBe('rejected');
      expect(listResult.status).toBe('rejected');
    });
  });

  describe('Metadata for Client-side Graceful Degradation', () => {
    it('should provide load status metadata', async () => {
      const mockCount = () => Promise.resolve(100);
      const mockFindMany = () => Promise.resolve([{ id: '1' }]);

      const [countResult, listResult] = await safeParallel([
        mockCount(),
        mockFindMany(),
      ]);

      const meta = {
        countLoaded: countResult.status === 'fulfilled',
        listLoaded: listResult.status === 'fulfilled',
      };

      expect(meta).toEqual({
        countLoaded: true,
        listLoaded: true,
      });
    });

    it('should indicate partial load failure', async () => {
      const mockCountFail = () => Promise.reject(new Error('Count failed'));
      const mockFindMany = () => Promise.resolve([{ id: '1' }]);

      const [countResult, listResult] = await safeParallel(
        [mockCountFail(), mockFindMany()],
        { logging: false }
      );

      const meta = {
        countLoaded: countResult.status === 'fulfilled',
        listLoaded: listResult.status === 'fulfilled',
      };

      expect(meta).toEqual({
        countLoaded: false,
        listLoaded: true,
      });
    });
  });

  describe('Error Handling: Edge Cases', () => {
    it('should handle non-Error rejection values', async () => {
      const results = await safeParallel(
        [
          Promise.resolve('success'),
          Promise.reject('string error'),
          Promise.reject({ custom: 'error' }),
        ],
        { logging: false }
      );

      const errors = getErrors(results);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBeInstanceOf(Error); // Converted to Error
      expect(errors[1]).toBeInstanceOf(Error); // Converted to Error
    });

    it('should handle empty promise array', async () => {
      const results = await safeParallel([]);
      expect(results).toEqual([]);
      expect(allFulfilled(results)).toBe(true);
    });

    it('should handle single promise', async () => {
      const results = await safeParallel([Promise.resolve('single')]);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('fulfilled');
    });
  });

  describe('Performance: Parallel Execution', () => {
    it('should execute promises in parallel (not sequentially)', async () => {
      const delays: number[] = [];

      const promise1 = new Promise((resolve) => {
        const start = Date.now();
        setTimeout(() => {
          delays.push(Date.now() - start);
          resolve('done1');
        }, 100);
      });

      const promise2 = new Promise((resolve) => {
        const start = Date.now();
        setTimeout(() => {
          delays.push(Date.now() - start);
          resolve('done2');
        }, 100);
      });

      const startTotal = Date.now();
      await safeParallel([promise1, promise2], { logging: false });
      const totalTime = Date.now() - startTotal;

      // Total time should be ~100ms (parallel), not ~200ms (sequential)
      expect(totalTime).toBeLessThan(200);
    });
  });
});
