import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export interface ValidatedOrgRequest {
  organizationId: string;
  userId: string;
  role: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates that the request is from an authenticated user with a valid organization.
 * Used in API routes that require organization-level access control.
 *
 * P0: organizationId 격리 — ensures user can only access their own organization's data
 */
export async function validateOrganizationRequest(req: NextRequest): Promise<ValidatedOrgRequest> {
  try {
    const session = await getMabizSession();

    if (!session) {
      throw new Error('No active session');
    }

    if (!session.organizationId) {
      throw new Error('No organization context in session');
    }

    return {
      organizationId: session.organizationId,
      userId: session.userId,
      role: session.role,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[validateOrganizationRequest] Auth validation failed', {
      error: errorMessage,
      url: req.url
    });
    throw new Error(`Unauthorized: ${errorMessage}`);
  }
}

/**
 * Alternative: Returns NextResponse directly if validation fails
 * Useful for conditional middleware
 */
export async function validateOrganizationRequestWithResponse(
  req: NextRequest
): Promise<ValidatedOrgRequest | NextResponse> {
  try {
    return await validateOrganizationRequest(req);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
}

/**
 * P0 Security: Validates that user can only access resources within their organization
 * Used in all API routes that access organization-scoped data
 *
 * Rules:
 * - OWNER/AGENT: Can only access their organizationId
 * - GLOBAL_ADMIN: Can access any organizationId
 */
export async function validateOrganizationAccess(
  organizationId: string,
  expectedOrgId: string,
  role?: string
): Promise<AccessCheckResult> {
  // GLOBAL_ADMIN can access any org
  if (role === 'GLOBAL_ADMIN') {
    return { allowed: true };
  }

  // Everyone else must match their organizationId
  if (organizationId !== expectedOrgId) {
    logger.warn('[validateOrganizationAccess] Cross-organization access attempted', {
      requestedOrg: expectedOrgId,
      userOrg: organizationId,
      role
    });
    return {
      allowed: false,
      reason: 'Cross-organization access denied'
    };
  }

  return { allowed: true };
}

/**
 * P0 Security: Validates profile-level isolation (for Affiliate/Agent systems)
 * Ensures users can only access data associated with their profileId
 */
export async function validateProfileAccess(
  userProfileId: number | undefined,
  targetProfileId: number | undefined,
  role?: string
): Promise<AccessCheckResult> {
  // GLOBAL_ADMIN or OWNER can access any profile
  if (role === 'GLOBAL_ADMIN' || role === 'OWNER') {
    return { allowed: true };
  }

  // AGENT can only access their own profile
  if (!userProfileId || userProfileId !== targetProfileId) {
    logger.warn('[validateProfileAccess] Cross-profile access attempted', {
      userProfileId,
      targetProfileId,
      role
    });
    return {
      allowed: false,
      reason: 'Cross-profile access denied'
    };
  }

  return { allowed: true };
}

/**
 * P1 Security: Audit log for unauthorized access attempts
 * Creates log entry for security investigation
 */
export async function logUnauthorizedAccess(
  organizationId: string,
  userId: string,
  resource: string,
  reason: string
): Promise<void> {
  try {
    // TODO: Implement audit log table in Prisma
    logger.warn('[SECURITY] Unauthorized access attempt', {
      organizationId,
      userId,
      resource,
      reason,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[logUnauthorizedAccess] Failed to log unauthorized access', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
