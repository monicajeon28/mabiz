/**
 * Route Rules Tests
 * Testing centralized path access control
 */

import {
  checkPathAccess,
  getRedirectForPath,
  hasRequiredRole,
  matchPattern,
  testRouteMatch,
  testAccessControl,
  ROUTE_RULES,
} from '@/src/lib/route-rules';
import { AuthRole } from '@/src/types/auth-headers';

describe('route-rules: Pattern Matching', () => {
  it('should match exact paths', () => {
    expect(matchPattern('/admin/dashboard', '/admin/*')).toBe(true);
    expect(matchPattern('/admin/users', '/admin/*')).toBe(true);
    expect(matchPattern('/admin', '/admin/*')).toBe(false);
  });

  it('should match glob patterns', () => {
    expect(matchPattern('/dashboard/team/members', '/dashboard/team/*')).toBe(
      true
    );
    expect(matchPattern('/dashboard/team', '/dashboard/team/*')).toBe(false);
  });

  it('should use testRouteMatch helper', () => {
    expect(testRouteMatch('/payments/history', '/payments/*')).toBe(true);
    expect(testRouteMatch('/payments', '/payments/*')).toBe(false);
  });
});

describe('route-rules: Role Hierarchy', () => {
  it('GLOBAL_ADMIN should have highest privilege', () => {
    expect(hasRequiredRole('GLOBAL_ADMIN', 'GLOBAL_ADMIN')).toBe(true);
    expect(hasRequiredRole('GLOBAL_ADMIN', 'MEMBER')).toBe(true);
    expect(hasRequiredRole('GLOBAL_ADMIN', 'UNKNOWN')).toBe(true);
  });

  it('MEMBER should have mid-level privilege', () => {
    expect(hasRequiredRole('MEMBER', 'GLOBAL_ADMIN')).toBe(false);
    expect(hasRequiredRole('MEMBER', 'MEMBER')).toBe(true);
    expect(hasRequiredRole('MEMBER', 'UNKNOWN')).toBe(true);
  });

  it('UNKNOWN should have lowest privilege', () => {
    expect(hasRequiredRole('UNKNOWN', 'GLOBAL_ADMIN')).toBe(false);
    expect(hasRequiredRole('UNKNOWN', 'MEMBER')).toBe(false);
    expect(hasRequiredRole('UNKNOWN', 'UNKNOWN')).toBe(true);
  });
});

describe('route-rules: Access Control', () => {
  it('GLOBAL_ADMIN should access /admin/*', () => {
    expect(checkPathAccess('/admin/dashboard', 'GLOBAL_ADMIN')).toBe(true);
    expect(checkPathAccess('/admin/users', 'GLOBAL_ADMIN')).toBe(true);
  });

  it('MEMBER should NOT access /admin/*', () => {
    expect(checkPathAccess('/admin/dashboard', 'MEMBER')).toBe(false);
    expect(checkPathAccess('/admin/users', 'MEMBER')).toBe(false);
  });

  it('UNKNOWN should NOT access /admin/*', () => {
    expect(checkPathAccess('/admin/dashboard', 'UNKNOWN')).toBe(false);
  });

  it('MEMBER should access /dashboard/*', () => {
    expect(checkPathAccess('/dashboard/contacts', 'MEMBER')).toBe(true);
    expect(checkPathAccess('/dashboard/campaigns', 'MEMBER')).toBe(true);
  });

  it('UNKNOWN should NOT access /dashboard/*', () => {
    expect(checkPathAccess('/dashboard/contacts', 'UNKNOWN')).toBe(false);
  });

  it('should allow public /pnr/* paths', () => {
    expect(checkPathAccess('/pnr/reservation-123', 'UNKNOWN')).toBe(true);
    expect(checkPathAccess('/pnr/reservation-456', 'MEMBER')).toBe(true);
  });

  it('should return null for null/undefined role', () => {
    expect(checkPathAccess('/dashboard/contacts', null)).toBe(false);
    expect(checkPathAccess('/dashboard/contacts', undefined)).toBe(false);
  });
});

describe('route-rules: Redirects', () => {
  it('should redirect MEMBER from /admin to /403-forbidden', () => {
    const redirect = getRedirectForPath('/admin/dashboard', 'MEMBER');
    expect(redirect).toBe('/403-forbidden');
  });

  it('should redirect UNKNOWN from /dashboard to /sign-in', () => {
    const redirect = getRedirectForPath('/dashboard/contacts', 'UNKNOWN');
    expect(redirect).toBe('/sign-in');
  });

  it('should return null for allowed access', () => {
    const redirect = getRedirectForPath('/dashboard/contacts', 'MEMBER');
    expect(redirect).toBeNull();
  });

  it('should return null for public paths', () => {
    const redirect = getRedirectForPath('/pnr/reservation-123', 'UNKNOWN');
    expect(redirect).toBeNull();
  });

  it('should redirect null role to /sign-in', () => {
    const redirect = getRedirectForPath('/dashboard/contacts', null);
    expect(redirect).toBe('/sign-in');
  });
});

describe('route-rules: testAccessControl helper', () => {
  it('should return allowed=true for valid access', () => {
    const result = testAccessControl('/admin/dashboard', 'GLOBAL_ADMIN');
    expect(result.allowed).toBe(true);
    expect(result.redirect).toBeNull();
  });

  it('should return redirect for denied access', () => {
    const result = testAccessControl('/admin/dashboard', 'MEMBER');
    expect(result.allowed).toBe(false);
    expect(result.redirect).toBe('/403-forbidden');
  });

  it('should handle public paths', () => {
    const result = testAccessControl('/pnr/reservation-123', 'UNKNOWN');
    expect(result.allowed).toBe(true);
    expect(result.redirect).toBeNull();
  });
});

describe('route-rules: ROUTE_RULES array', () => {
  it('should have 11+ rules defined', () => {
    expect(ROUTE_RULES.length).toBeGreaterThanOrEqual(11);
  });

  it('should have /admin/* rule', () => {
    const adminRule = ROUTE_RULES.find(r => r.pattern === '/admin/*');
    expect(adminRule).toBeDefined();
    expect(adminRule?.requiredRole).toBe('GLOBAL_ADMIN');
  });

  it('should have /pnr/* rule', () => {
    const pnrRule = ROUTE_RULES.find(r => r.pattern === '/pnr/*');
    expect(pnrRule).toBeDefined();
    expect(pnrRule?.requiredRole).toBe('UNKNOWN');
  });

  it('should have /dashboard/* rule', () => {
    const dashboardRule = ROUTE_RULES.find(r => r.pattern === '/dashboard/*');
    expect(dashboardRule).toBeDefined();
    expect(dashboardRule?.requiredRole).toBe('MEMBER');
  });
});

describe('route-rules: Edge cases', () => {
  it('should handle paths with trailing slashes', () => {
    expect(matchPattern('/admin/dashboard/', '/admin/*')).toBe(true);
  });

  it('should handle paths with special characters', () => {
    expect(matchPattern('/pnr/res-123-456', '/pnr/*')).toBe(true);
  });

  it('should not match partial patterns', () => {
    expect(matchPattern('/admin', '/admin/*')).toBe(false);
    expect(matchPattern('/admin-panel', '/admin/*')).toBe(false);
  });

  it('should handle nested paths correctly', () => {
    expect(matchPattern('/dashboard/team/members/list', '/dashboard/team/*')).toBe(
      true
    );
  });
});
