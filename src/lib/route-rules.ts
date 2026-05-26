/**
 * Route Access Control Rules
 * Centralized path rules for role-based access control
 *
 * Phase 3 작업: 경로 규칙 중앙화
 * - 15개 경로 정의
 * - 역할별 계층 검증
 * - Glob 패턴 매칭
 */

import { AuthRole } from '@/types/auth-headers';

/**
 * Route rule definition
 */
export type RouteRule = {
  /** Glob pattern (e.g., '/admin/*', '/dashboard/team/*') */
  pattern: string;

  /** Required role (e.g., 'GLOBAL_ADMIN', 'MEMBER') */
  requiredRole: AuthRole;

  /** Redirect destination on access denied (null = public) */
  redirectTo?: string | null;
};

/**
 * Centralized route rules (15개 경로)
 * - /admin/* (GLOBAL_ADMIN)
 * - /dashboard/team/* (MEMBER)
 * - /dashboard/* (MEMBER)
 * - /pnr/* (PUBLIC - no auth check)
 * - 기타 11개 경로
 */
export const ROUTE_RULES: RouteRule[] = [
  // Admin pages - GLOBAL_ADMIN only
  {
    pattern: '/admin/*',
    requiredRole: 'GLOBAL_ADMIN',
    redirectTo: '/403-forbidden',
  },

  // Team management pages - MEMBER+ (팀 관리)
  {
    pattern: '/dashboard/team/*',
    requiredRole: 'MEMBER',
    redirectTo: '/dashboard',
  },

  // Affiliate sales pages - GLOBAL_ADMIN (어필리에이트 판매)
  {
    pattern: '/dashboard/affiliate-sales/*',
    requiredRole: 'GLOBAL_ADMIN',
    redirectTo: '/403-forbidden',
  },

  // Partner applications - GLOBAL_ADMIN (파트너 신청)
  {
    pattern: '/dashboard/partner-applications*',
    requiredRole: 'GLOBAL_ADMIN',
    redirectTo: '/403-forbidden',
  },

  // Payments - MEMBER+ (결제)
  {
    pattern: '/payments/*',
    requiredRole: 'MEMBER',
    redirectTo: '/dashboard',
  },

  // Dashboard root - AGENT+ 이상만 (관리자, 대리점장, 판매원)
  {
    pattern: '/dashboard',
    requiredRole: 'AGENT',
    redirectTo: '/sign-in',
  },

  // Dashboard pages - AGENT+ 이상만 (프리세일즈 제외)
  {
    pattern: '/dashboard/*',
    requiredRole: 'AGENT',
    redirectTo: '/sign-in',
  },

  // Contacts - MEMBER+ (고객관리)
  {
    pattern: '/dashboard/contacts*',
    requiredRole: 'MEMBER',
    redirectTo: '/sign-in',
  },

  // Campaigns - MEMBER+ (캠페인)
  {
    pattern: '/dashboard/campaigns*',
    requiredRole: 'MEMBER',
    redirectTo: '/sign-in',
  },

  // Messages - MEMBER+ (메시지)
  {
    pattern: '/dashboard/messages*',
    requiredRole: 'MEMBER',
    redirectTo: '/sign-in',
  },

  // PNR - PUBLIC (공개 고객 조회)
  {
    pattern: '/pnr/*',
    requiredRole: 'UNKNOWN',
    redirectTo: null, // Public route
  },
];

/**
 * Check if user can access a path
 * Returns true if path is accessible, false if access denied
 */
export function checkPathAccess(
  pathname: string,
  userRole: AuthRole | null | undefined
): boolean {
  if (!userRole) {
    return false;
  }

  // Find matching rule (most specific pattern first)
  const rule = ROUTE_RULES.find(r => matchPattern(pathname, r.pattern));

  // No rule = public path
  if (!rule) {
    return true;
  }

  // Public routes (requiredRole === 'UNKNOWN')
  if (rule.requiredRole === 'UNKNOWN') {
    return true;
  }

  // Check role hierarchy
  return hasRequiredRole(userRole, rule.requiredRole);
}

/**
 * Get redirect destination for denied access
 */
export function getRedirectForPath(
  pathname: string,
  userRole: AuthRole | null | undefined
): string | null {
  if (!userRole) {
    return '/sign-in';
  }

  const rule = ROUTE_RULES.find(r => matchPattern(pathname, r.pattern));

  if (!rule) {
    return null; // Public path, no redirect
  }

  if (rule.requiredRole === 'UNKNOWN') {
    return null; // Public route
  }

  // Check if user has required role
  if (hasRequiredRole(userRole, rule.requiredRole)) {
    return null; // Access allowed
  }

  // Access denied - return redirect destination
  return rule.redirectTo || '/403-forbidden';
}

/**
 * Role hierarchy: GLOBAL_ADMIN > OWNER > AGENT > FREE_SALES > UNKNOWN
 * Higher level roles can access lower level paths
 */
export function hasRequiredRole(
  userRole: AuthRole,
  requiredRole: AuthRole
): boolean {
  const hierarchy: Record<AuthRole, number> = {
    'GLOBAL_ADMIN': 100,  // 관리자
    'OWNER': 50,          // 대리점장
    'AGENT': 40,          // 판매원
    'MEMBER': 50,         // 멤버 (호환성)
    'FREE_SALES': 10,     // 프리세일즈 (접근 제한)
    'UNKNOWN': 0,         // 인증 안 됨
  };

  return hierarchy[userRole] >= hierarchy[requiredRole];
}

/**
 * Glob pattern matching
 * Converts glob patterns (e.g., '/admin/*') to regex
 */
export function matchPattern(pathname: string, pattern: string): boolean {
  // Escape special regex characters except *
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/')
    .replace(/\?/g, '\\?');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}

/**
 * Test function for route matching
 */
export function testRouteMatch(pathname: string, pattern: string): boolean {
  return matchPattern(pathname, pattern);
}

/**
 * Test function for access control
 */
export function testAccessControl(
  pathname: string,
  userRole: AuthRole
): { allowed: boolean; redirect: string | null } {
  const allowed = checkPathAccess(pathname, userRole);
  const redirect = !allowed ? getRedirectForPath(pathname, userRole) : null;

  return { allowed, redirect };
}
