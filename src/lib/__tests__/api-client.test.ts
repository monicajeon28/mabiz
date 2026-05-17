/**
 * API 클라이언트 헬퍼 테스트
 */

import { apiClient } from '../api/client';
import type { ApiResponse } from '../api/response';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should make a GET request', async () => {
      const mockData = { ok: true, data: { id: 1, name: 'Test' } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      const result = await apiClient.get('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockData);
    });

    it('should append query parameters', async () => {
      const mockData = { ok: true, data: [] };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      const result = await apiClient.get('/api/users', {
        query: { page: 1, limit: 10 },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('should skip undefined query parameters', async () => {
      const mockData = { ok: true, data: [] };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      await apiClient.get('/api/users', {
        query: { page: 1, limit: undefined, search: '' },
      });

      const url = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(url).not.toContain('limit');
      expect(url).not.toContain('search');
      expect(url).toContain('page=1');
    });
  });

  describe('POST requests', () => {
    it('should make a POST request with data', async () => {
      const mockData = { ok: true, data: { id: 1 } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      const postData = { name: 'Test', email: 'test@example.com' };
      const result = await apiClient.post('/api/users', postData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should make a POST request without data', async () => {
      const mockData = { ok: true, data: null };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      await apiClient.post('/api/action');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/action',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });

  describe('PATCH requests', () => {
    it('should make a PATCH request', async () => {
      const mockData = { ok: true, data: { id: 1, updated: true } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      const updateData = { name: 'Updated Name' };
      const result = await apiClient.patch('/api/users/1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('DELETE requests', () => {
    it('should make a DELETE request', async () => {
      const mockData = { ok: true, data: null };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      const result = await apiClient.delete('/api/users/1');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('Header handling', () => {
    it('should set Content-Type header', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ ok: true, data: null }),
      });

      await apiClient.get('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should merge custom headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ ok: true, data: null }),
      });

      await apiClient.get('/api/test', {
        headers: { 'X-Custom-Header': 'value' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'value',
          }),
        })
      );
    });
  });

  describe('PUT requests', () => {
    it('should make a PUT request', async () => {
      const mockData = { ok: true, data: { id: 1 } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockData,
      });

      const putData = { name: 'Replaced' };
      const result = await apiClient.put('/api/users/1', putData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(putData),
        })
      );
      expect(result).toEqual(mockData);
    });
  });
});
