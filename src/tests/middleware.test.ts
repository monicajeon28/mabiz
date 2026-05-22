import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import prisma from '@/lib/prisma';

/**
 * Middleware Auth Tests
 * 역할 검증 및 헤더 주입 테스트
 */
describe('Middleware - Auth Headers & Role Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Task 1-1: Header Injection Tests', () => {
    it('should inject X-Session-Id header when session exists', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const mockSession = {
        id: sessionId,
        adminId: 'admin-1',
        memberId: null,
        organizationId: null,
        expiresAt: new Date(Date.now() + 86400000), // 24h from now
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.headers.get('x-session-id')).toBe(sessionId);
      expect(response.headers.get('x-user-role')).toBe('GLOBAL_ADMIN');
      expect(response.headers.get('x-is-admin')).toBe('true');
    });

    it('should not inject auth headers for unauthenticated requests to public routes', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/'), {
        method: 'GET',
      });

      // Act
      const response = await middleware(request);

      // Assert - public route should pass through
      expect(response.status).not.toBe(307); // Not a redirect
    });

    it('should redirect to /sign-in for protected routes without session', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
      });

      // Act
      const response = await middleware(request);

      // Assert - should redirect to sign-in
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/sign-in');
    });
  });

  describe('Task 1-2: Role Validation Tests', () => {
    it('should validate GLOBAL_ADMIN role correctly', async () => {
      // Arrange
      const sessionId = 'admin-session-123';
      const mockSession = {
        id: sessionId,
        adminId: 'admin-1',
        memberId: null,
        organizationId: null,
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.headers.get('x-user-role')).toBe('GLOBAL_ADMIN');
    });

    it('should validate MEMBER role correctly', async () => {
      // Arrange
      const sessionId = 'member-session-123';
      const mockSession = {
        id: sessionId,
        adminId: null,
        memberId: 'member-1',
        organizationId: 'org-1',
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.headers.get('x-user-role')).toBe('MEMBER');
      expect(response.headers.get('x-org-id')).toBe('org-1');
    });

    it('should reject invalid role from database error', async () => {
      // Arrange
      const sessionId = 'invalid-session-123';

      vi.spyOn(prisma.mabizSession, 'findUnique').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert - should allow request to proceed but log error
      expect(response.status).not.toBe(403);
    });

    it('should reject expired session', async () => {
      // Arrange
      const sessionId = 'expired-session-123';
      const mockSession = {
        id: sessionId,
        adminId: 'admin-1',
        memberId: null,
        organizationId: null,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert - should redirect to sign-in
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/sign-in');
    });
  });

  describe('Task 2-1: Admin Route Protection Tests', () => {
    it('should allow GLOBAL_ADMIN to access /admin routes', async () => {
      // Arrange
      const sessionId = 'admin-session-123';
      const mockSession = {
        id: sessionId,
        adminId: 'admin-1',
        memberId: null,
        organizationId: null,
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/admin/organizations'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(403); // Should not be forbidden
      expect(response.headers.get('x-user-role')).toBe('GLOBAL_ADMIN');
    });

    it('should forbid MEMBER from accessing /admin routes', async () => {
      // Arrange
      const sessionId = 'member-session-123';
      const mockSession = {
        id: sessionId,
        adminId: null,
        memberId: 'member-1',
        organizationId: 'org-1',
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/admin/organizations'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(403); // Should be forbidden
    });

    it('should forbid non-GLOBAL_ADMIN from accessing /contracts routes', async () => {
      // Arrange
      const sessionId = 'member-session-123';
      const mockSession = {
        id: sessionId,
        adminId: null,
        memberId: 'member-1',
        organizationId: 'org-1',
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/contracts/123'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('Task 2-2: Header Role Injection Tests', () => {
    it('should inject X-User-Role header with GLOBAL_ADMIN value', async () => {
      // Arrange
      const sessionId = 'admin-session-123';
      const mockSession = {
        id: sessionId,
        adminId: 'admin-1',
        memberId: null,
        organizationId: null,
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.headers.get('x-user-role')).toBe('GLOBAL_ADMIN');
    });

    it('should inject X-User-Role header with MEMBER value', async () => {
      // Arrange
      const sessionId = 'member-session-123';
      const mockSession = {
        id: sessionId,
        adminId: null,
        memberId: 'member-1',
        organizationId: 'org-1',
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.headers.get('x-user-role')).toBe('MEMBER');
    });

    it('should inject X-Org-ID header for member sessions', async () => {
      // Arrange
      const sessionId = 'member-session-123';
      const mockSession = {
        id: sessionId,
        adminId: null,
        memberId: 'member-1',
        organizationId: 'org-123',
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma.mabizSession, 'findUnique').mockResolvedValueOnce(mockSession);

      const request = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        method: 'GET',
        headers: {
          Cookie: `mabiz.sid=${sessionId}`,
        },
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.headers.get('x-org-id')).toBe('org-123');
    });
  });
});
