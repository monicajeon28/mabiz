/**
 * Aligo IP Whitelist 검증 테스트
 *
 * Test Cases:
 * 1. getServerPublicIP() - 서버 public IP 조회 및 캐싱
 * 2. detectAligoSendingIP() - NextRequest에서 발신 IP 감지
 * 3. validateAligoIPWhitelist() - Aligo 화이트리스트 검증
 */

import { NextRequest } from 'next/server';
import {
  getServerPublicIP,
  detectAligoSendingIP,
  validateAligoIPWhitelist,
  clearIPCache,
  getIPCacheStatus,
  type IPWhitelistStatus,
} from '../ip-whitelist';
import { AligoClient } from '../client';
import { logger } from '@/lib/logger';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('IP Whitelist Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearIPCache();
  });

  describe('getServerPublicIP()', () => {
    it('should successfully retrieve public IP from ipify', async () => {
      const mockIP = '203.0.113.42';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: mockIP }),
      });

      const result = await getServerPublicIP();

      expect(result).toBe(mockIP);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.ipify.org?format=json',
        expect.any(Object)
      );
      expect(logger.log).toHaveBeenCalledWith(
        '[Aligo IP] public IP 조회 성공',
        expect.objectContaining({ ip: mockIP })
      );
    });

    it('should successfully retrieve public IP from amazonaws', async () => {
      const mockIP = '198.51.100.89';

      // First call fails
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('ipify timeout'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockIP,
        });

      const result = await getServerPublicIP();

      expect(result).toBe(mockIP);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://checkip.amazonaws.com',
        expect.any(Object)
      );
    });

    it('should successfully retrieve public IP from ifconfig.me', async () => {
      const mockIP = '192.0.2.100';

      // ipify와 amazonaws 실패, ifconfig 성공
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('ipify timeout'))
        .mockRejectedValueOnce(new Error('amazonaws timeout'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockIP,
        });

      const result = await getServerPublicIP();

      expect(result).toBe(mockIP);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://ifconfig.me',
        expect.any(Object)
      );
    });

    it('should return "unknown" when all services fail', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await getServerPublicIP();

      expect(result).toBe('unknown');
      expect(logger.warn).toHaveBeenCalledWith(
        '[Aligo IP] 모든 서비스 실패, 기본값 사용'
      );
    });

    it('should return "unknown" when IP format is invalid', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: 'invalid-ip' }),
      });

      const result = await getServerPublicIP();

      expect(result).toBe('unknown');
    });

    it('should cache IP for 5 minutes', async () => {
      const mockIP = '203.0.113.42';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ip: mockIP }),
      });

      // First call - should fetch
      const result1 = await getServerPublicIP();
      expect(result1).toBe(mockIP);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await getServerPublicIP();
      expect(result2).toBe(mockIP);
      expect(global.fetch).toHaveBeenCalledTimes(1); // No additional fetch

      expect(logger.debug).toHaveBeenCalledWith(
        '[Aligo IP] 캐시된 public IP 사용',
        expect.any(Object)
      );
    });

    it('should validate IP format with regex', async () => {
      const validIPs = ['203.0.113.42', '192.168.1.1', '10.0.0.1'];

      for (const ip of validIPs) {
        clearIPCache();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ip }),
        });

        const result = await getServerPublicIP();
        expect(result).toBe(ip);
      }
    });

    it('should handle timeout with AbortSignal', async () => {
      const timeoutError = new Error('Timeout');
      (global.fetch as jest.Mock).mockRejectedValue(timeoutError);

      const result = await getServerPublicIP();

      expect(result).toBe('unknown');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('detectAligoSendingIP()', () => {
    it('should detect IP from x-forwarded-for header', () => {
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '203.0.113.42, 198.51.100.1'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('203.0.113.42');
      expect(logger.log).toHaveBeenCalledWith(
        '[Aligo IP] 발신 IP 감지 (x-forwarded-for)',
        expect.objectContaining({ ip: '203.0.113.42' })
      );
    });

    it('should detect IP from cf-connecting-ip header (Cloudflare)', () => {
      const mockRequest = {
        headers: new Map([
          ['cf-connecting-ip', '192.0.2.100'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('192.0.2.100');
      expect(logger.log).toHaveBeenCalledWith(
        '[Aligo IP] 발신 IP 감지 (cf-connecting-ip)',
        expect.objectContaining({ ip: '192.0.2.100' })
      );
    });

    it('should detect IP from x-real-ip header (Nginx)', () => {
      const mockRequest = {
        headers: new Map([
          ['x-real-ip', '198.51.100.89'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('198.51.100.89');
      expect(logger.log).toHaveBeenCalledWith(
        '[Aligo IP] 발신 IP 감지 (x-real-ip)',
        expect.objectContaining({ ip: '198.51.100.89' })
      );
    });

    it('should return "localhost" when no headers match', () => {
      const mockRequest = {
        headers: new Map([
          ['user-agent', 'Test Agent'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('localhost');
      expect(logger.warn).toHaveBeenCalledWith(
        '[Aligo IP] 알려진 헤더에서 IP 감지 불가, localhost 추정'
      );
    });

    it('should return "unknown" when NextRequest is not provided', () => {
      const result = detectAligoSendingIP(undefined);

      expect(result).toBe('unknown');
      expect(logger.debug).toHaveBeenCalledWith(
        '[Aligo IP] NextRequest 없음, 기본 감지 스킵'
      );
    });

    it('should prioritize x-forwarded-for over other headers', () => {
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '203.0.113.42'],
          ['cf-connecting-ip', '192.0.2.100'],
          ['x-real-ip', '198.51.100.89'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('203.0.113.42');
    });

    it('should take first IP from x-forwarded-for with multiple IPs', () => {
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '203.0.113.42, 198.51.100.1, 192.0.2.100'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('203.0.113.42');
    });

    it('should skip invalid IP format in header', () => {
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', 'invalid-ip'],
          ['cf-connecting-ip', '192.0.2.100'],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      expect(result).toBe('192.0.2.100');
    });
  });

  describe('validateAligoIPWhitelist()', () => {
    it('should return isWhitelisted=true when sender is verified', async () => {
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(true),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, '203.0.113.42');

      expect(result.isWhitelisted).toBe(true);
      expect(result.currentIP).toBe('203.0.113.42');
      expect(result.aligoVerified).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(
        '[Aligo IP] 화이트리스트 검증 완료',
        expect.any(Object)
      );
    });

    it('should return isWhitelisted=false when sender is not verified', async () => {
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(false),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, '203.0.113.42');

      expect(result.isWhitelisted).toBe(false);
      expect(result.currentIP).toBe('203.0.113.42');
      expect(result.aligoVerified).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      const mockClient = {
        verifySenderNumber: jest
          .fn()
          .mockRejectedValue(new Error('API Error')),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, '203.0.113.42');

      expect(result.isWhitelisted).toBe(false);
      expect(result.error).toBe('API Error');
      expect(logger.error).toHaveBeenCalledWith(
        '[Aligo IP] 검증 중 오류',
        expect.any(Object)
      );
    });

    it('should retrieve public IP when currentIP is not provided', async () => {
      const mockIP = '203.0.113.42';
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(true),
      } as unknown as AligoClient;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: mockIP }),
      });

      const result = await validateAligoIPWhitelist(mockClient);

      expect(result.currentIP).toBe(mockIP);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return isWhitelisted=false for "unknown" IP', async () => {
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(true),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, 'unknown');

      expect(result.isWhitelisted).toBe(false);
      expect(result.currentIP).toBe('unknown');
      expect(result.error).toBe('IP를 감지할 수 없습니다.');
      expect(logger.warn).toHaveBeenCalledWith(
        '[Aligo IP] IP 감지 불가, 검증 스킵',
        expect.any(Object)
      );
    });

    it('should return isWhitelisted=false for "localhost" IP', async () => {
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(true),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, 'localhost');

      expect(result.isWhitelisted).toBe(false);
      expect(result.currentIP).toBe('localhost');
      expect(result.error).toBe('IP를 감지할 수 없습니다.');
    });

    it('should provide helpful suggestion for development environment', async () => {
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(true),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, 'unknown');

      expect(result.suggestion).toContain('로컬 개발 환경');
    });

    it('should provide helpful suggestion for Aligo dashboard', async () => {
      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(false),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(mockClient, '203.0.113.42');

      expect(result.suggestion).toContain('Aligo 대시보드');
    });
  });

  describe('Integrated Workflow', () => {
    it('should detect and validate IP in sequence', async () => {
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '203.0.113.42'],
        ]),
      } as unknown as NextRequest;

      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(true),
      } as unknown as AligoClient;

      // Step 1: Detect IP from request
      const detectedIP = detectAligoSendingIP(mockRequest);
      expect(detectedIP).toBe('203.0.113.42');

      // Step 2: Validate with Aligo
      const validationResult = await validateAligoIPWhitelist(
        mockClient,
        detectedIP
      );

      expect(validationResult.isWhitelisted).toBe(true);
      expect(validationResult.currentIP).toBe('203.0.113.42');
    });

    it('should handle missing IP gracefully in workflow', async () => {
      const mockRequest = {
        headers: new Map([]),
      } as unknown as NextRequest;

      const mockClient = {
        verifySenderNumber: jest.fn().mockResolvedValue(false),
      } as unknown as AligoClient;

      // Step 1: Detect IP (will return localhost)
      const detectedIP = detectAligoSendingIP(mockRequest);
      expect(detectedIP).toBe('localhost');

      // Step 2: Validate (will skip validation)
      const validationResult = await validateAligoIPWhitelist(
        mockClient,
        detectedIP
      );

      expect(validationResult.isWhitelisted).toBe(false);
      expect(validationResult.error).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should provide cache status', () => {
      const status = getIPCacheStatus();

      expect(status).toHaveProperty('size');
      expect(status).toHaveProperty('entries');
      expect(Array.isArray(status.entries)).toBe(true);
    });

    it('should clear cache', async () => {
      const mockIP = '203.0.113.42';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ip: mockIP }),
      });

      // First call - caches IP
      await getServerPublicIP();
      let cacheStatus = getIPCacheStatus();
      expect(cacheStatus.size).toBeGreaterThan(0);

      // Clear cache
      clearIPCache();
      cacheStatus = getIPCacheStatus();
      expect(cacheStatus.size).toBe(0);

      expect(logger.debug).toHaveBeenCalledWith(
        '[Aligo IP] 캐시 초기화 완료'
      );
    });

    it('should maintain separate cache entries', async () => {
      const mockIP = '203.0.113.42';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ip: mockIP }),
      });

      // Populate cache
      await getServerPublicIP();
      const statusBefore = getIPCacheStatus();

      // Cache should not be empty
      expect(statusBefore.size).toBeGreaterThan(0);
      expect(statusBefore.entries).toContain('server_public_ip');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors in getServerPublicIP', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await getServerPublicIP();

      expect(result).toBe('unknown');
    });

    it('should handle malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Missing 'ip' field
      });

      const result = await getServerPublicIP();

      expect(result).toBe('unknown');
    });

    it('should handle non-200 HTTP responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getServerPublicIP();

      expect(result).toBe('unknown');
    });

    it('should handle client errors gracefully', async () => {
      const mockClient = {
        verifySenderNumber: jest
          .fn()
          .mockRejectedValue(new Error('Network timeout')),
      } as unknown as AligoClient;

      const result = await validateAligoIPWhitelist(
        mockClient,
        '203.0.113.42'
      );

      expect(result.isWhitelisted).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('IPV4 Format Validation', () => {
    const validIPs = [
      '0.0.0.0',
      '127.0.0.1',
      '192.168.1.1',
      '203.0.113.42',
      '255.255.255.255',
    ];

    const invalidIPs = [
      '192.168.1', // Incomplete
      '192.168.1.1.1', // Too many octets
      'not.an.ip.address',
      '192.168.1', // Missing octet
      '...', // No digits
    ];

    validIPs.forEach((ip) => {
      it(`should accept valid IP format: ${ip}`, async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ip }),
        });

        const result = await getServerPublicIP();
        expect(result).toBe(ip);
      });
    });

    invalidIPs.forEach((ip) => {
      it(`should reject invalid IP format: ${ip}`, async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ip }),
        });

        const result = await getServerPublicIP();
        expect(result).toBe('unknown');
      });
    });
  });

  describe('Vercel Environment Simulation', () => {
    it('should detect IP correctly in Vercel environment with x-forwarded-for', () => {
      const mockRequest = {
        headers: new Map([
          // Vercel sets multiple IPs in x-forwarded-for
          [
            'x-forwarded-for',
            '203.0.113.42, 76.76.19.93, 2600:1700:11e0:cc50:c2e3:4b7b:2c70:0',
          ],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      // Should take the first IP (client IP)
      expect(result).toBe('203.0.113.42');
    });

    it('should handle IPv6 addresses by ignoring them', () => {
      const mockRequest = {
        headers: new Map([
          [
            'x-forwarded-for',
            '2600:1700:11e0:cc50:c2e3:4b7b:2c70:0',
          ],
        ]),
      } as unknown as NextRequest;

      const result = detectAligoSendingIP(mockRequest);

      // IPv6 doesn't match the regex, should skip to next header
      expect(result).toBe('localhost');
    });
  });
});
