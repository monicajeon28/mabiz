import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export interface ValidatedOrgRequest {
  organizationId: string;
  userId: string;
  role: string;
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
