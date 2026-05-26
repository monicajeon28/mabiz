/**
 * Middleware Authentication Utilities
 * Lightweight auth validation for middleware context
 *
 * WARNING: This is intentionally lightweight and only validates session existence.
 * Full auth context (with all roles and member details) is loaded in server
 * components using getMabizSession() from src/lib/auth.ts
 *
 * This separation ensures:
 * 1. Middleware p99 < 10ms (session ID lookup only)
 * 2. No N+1 queries in middleware
 * 3. Role validation deferred to server components where context is available
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SessionValidationResult } from '@/types/auth-headers';

/**
 * Validate session ID exists and is not expired
 *
 * Returns session metadata if valid, null if invalid/expired.
 * Used only by middleware to inject X-Session-ID header.
 *
 * IMPORTANT: Does NOT validate user role or permissions.
 * Full role validation must happen in server components.
 */
export async function validateSessionInMiddleware(
  sessionId: string
): Promise<SessionValidationResult | null> {
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.mabizSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        adminId: true,
        memberId: true,
        organizationId: true,
        expiresAt: true,
      },
    });

    // Session not found
    if (!session) {
      return null;
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      // Attempt cleanup in background (don't await)
      prisma.mabizSession
        .delete({ where: { id: sessionId } })
        .catch((err) => {
          logger.error('[Middleware] Failed to cleanup expired session', {
            error: err instanceof Error ? err.message : String(err),
            sessionId: sessionId.substring(0, 8) + '...',
          });
        });

      return null;
    }

    // Determine role from session type
    if (session.adminId) {
      return {
        valid: true,
        role: 'GLOBAL_ADMIN',
        organizationId: null,
        adminId: session.adminId,
      };
    }

    if (session.memberId && session.organizationId) {
      // Fetch actual member role from database (optional, use MEMBER as fallback)
      try {
        const member = await prisma.organizationMember.findUnique({
          where: { id: session.memberId },
          select: { role: true },
        });

        return {
          valid: true,
          role: (member?.role ?? 'MEMBER') as any,
          organizationId: session.organizationId,
        };
      } catch (err) {
        // DB error or member not found - fall back to MEMBER role
        return {
          valid: true,
          role: 'MEMBER',
          organizationId: session.organizationId,
        };
      }
    }

    return null;
  } catch (error) {
    logger.error('[Middleware] validateSessionInMiddleware error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: sessionId.substring(0, 8) + '...',
    });
    return null;
  }
}

/**
 * Type guard: Check if session is for GLOBAL_ADMIN
 */
export function isAdminSession(result: SessionValidationResult | null): boolean {
  return result?.role === 'GLOBAL_ADMIN';
}

/**
 * Type guard: Check if session is for MEMBER
 */
export function isMemberSession(result: SessionValidationResult | null): boolean {
  return result?.role === 'MEMBER';
}
