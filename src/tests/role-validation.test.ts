import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isAdminSession, isMemberSession } from '@/lib/middleware-auth';
import { parseAuthHeaders, setAuthHeaders } from '@/types/auth-headers';
import type { SessionValidationResult } from '@/types/auth-headers';

/**
 * Role Validation Tests
 * Task 1-2 역할 검증 유틸 테스트
 */
describe('Role Validation Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAdminSession Type Guard', () => {
    it('should return true for GLOBAL_ADMIN session', () => {
      // Arrange
      const result: SessionValidationResult = {
        valid: true,
        role: 'GLOBAL_ADMIN',
        organizationId: null,
        adminId: 'admin-1',
      };

      // Act
      const isAdmin = isAdminSession(result);

      // Assert
      expect(isAdmin).toBe(true);
    });

    it('should return false for MEMBER session', () => {
      // Arrange
      const result: SessionValidationResult = {
        valid: true,
        role: 'MEMBER',
        organizationId: 'org-1',
      };

      // Act
      const isAdmin = isAdminSession(result);

      // Assert
      expect(isAdmin).toBe(false);
    });

    it('should return false for null session', () => {
      // Act
      const isAdmin = isAdminSession(null);

      // Assert
      expect(isAdmin).toBe(false);
    });
  });

  describe('isMemberSession Type Guard', () => {
    it('should return true for MEMBER session', () => {
      // Arrange
      const result: SessionValidationResult = {
        valid: true,
        role: 'MEMBER',
        organizationId: 'org-1',
      };

      // Act
      const isMember = isMemberSession(result);

      // Assert
      expect(isMember).toBe(true);
    });

    it('should return false for GLOBAL_ADMIN session', () => {
      // Arrange
      const result: SessionValidationResult = {
        valid: true,
        role: 'GLOBAL_ADMIN',
        organizationId: null,
        adminId: 'admin-1',
      };

      // Act
      const isMember = isMemberSession(result);

      // Assert
      expect(isMember).toBe(false);
    });

    it('should return false for null session', () => {
      // Act
      const isMember = isMemberSession(null);

      // Assert
      expect(isMember).toBe(false);
    });
  });

  describe('parseAuthHeaders', () => {
    it('should parse all auth headers correctly', () => {
      // Arrange
      const headers = new Headers({
        'x-session-id': 'session-123',
        'x-user-role': 'GLOBAL_ADMIN',
        'x-org-id': 'org-1',
        'x-is-admin': 'true',
      });

      // Act
      const auth = parseAuthHeaders(headers);

      // Assert
      expect(auth.sessionId).toBe('session-123');
      expect(auth.userRole).toBe('GLOBAL_ADMIN');
      expect(auth.orgId).toBe('org-1');
      expect(auth.isAdmin).toBe(true);
    });

    it('should default to UNKNOWN role when missing', () => {
      // Arrange
      const headers = new Headers();

      // Act
      const auth = parseAuthHeaders(headers);

      // Assert
      expect(auth.userRole).toBe('UNKNOWN');
      expect(auth.isAdmin).toBe(false);
    });

    it('should handle missing org-id as null', () => {
      // Arrange
      const headers = new Headers({
        'x-session-id': 'session-123',
        'x-user-role': 'MEMBER',
      });

      // Act
      const auth = parseAuthHeaders(headers);

      // Assert
      expect(auth.orgId).toBeNull();
    });

    it('should parse x-is-admin as boolean correctly', () => {
      // Arrange - test true
      const headerTrue = new Headers({
        'x-is-admin': 'true',
      });

      // Act
      const authTrue = parseAuthHeaders(headerTrue);

      // Assert
      expect(authTrue.isAdmin).toBe(true);

      // Arrange - test false
      const headerFalse = new Headers({
        'x-is-admin': 'false',
      });

      // Act
      const authFalse = parseAuthHeaders(headerFalse);

      // Assert
      expect(authFalse.isAdmin).toBe(false);
    });
  });

  describe('setAuthHeaders', () => {
    it('should set all auth headers', () => {
      // Arrange
      const headers = new Headers();

      // Act
      setAuthHeaders(headers, {
        sessionId: 'session-123',
        userRole: 'GLOBAL_ADMIN',
        orgId: 'org-1',
        isAdmin: true,
      });

      // Assert
      expect(headers.get('x-session-id')).toBe('session-123');
      expect(headers.get('x-user-role')).toBe('GLOBAL_ADMIN');
      expect(headers.get('x-org-id')).toBe('org-1');
      expect(headers.get('x-is-admin')).toBe('true');
    });

    it('should set only specified headers', () => {
      // Arrange
      const headers = new Headers();

      // Act
      setAuthHeaders(headers, {
        userRole: 'MEMBER',
      });

      // Assert
      expect(headers.get('x-user-role')).toBe('MEMBER');
      expect(headers.has('x-session-id')).toBe(false);
      expect(headers.has('x-org-id')).toBe(false);
    });

    it('should handle empty orgId as empty string', () => {
      // Arrange
      const headers = new Headers();

      // Act
      setAuthHeaders(headers, {
        orgId: null,
      });

      // Assert
      expect(headers.get('x-org-id')).toBe('');
    });
  });
});
