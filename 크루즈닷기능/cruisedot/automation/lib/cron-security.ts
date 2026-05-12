import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateCsrfToken } from './csrf';

/**
 * Zod schema for Bearer token validation
 * Format: "Bearer <token>"
 */
const bearerTokenSchema = z
  .string()
  .min(1, 'Authorization header is required')
  .refine(
    (val) => val.startsWith('Bearer '),
    'Authorization header must start with "Bearer "'
  )
  .transform((val) => val.slice(7)) // Extract token after "Bearer "
  .refine((token) => token.length > 0, 'Bearer token cannot be empty');

/**
 * Verifies Cron secret from Vercel (Bearer token)
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param req - NextRequest object
 * @returns { valid: boolean, error?: string }
 */
export function verifyCronSecret(req: NextRequest): { valid: boolean; error?: string } {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return { valid: false, error: 'CRON_SECRET not configured' };
    }

    const headerSecret = req.headers.get('authorization');
    if (!headerSecret) {
      return { valid: false, error: 'Missing authorization header' };
    }

    // Validate Bearer token format using Zod
    const extractedToken = bearerTokenSchema.parse(headerSecret);

    // Use constant-time comparison (same as validateCsrfToken pattern)
    const isValid = validateCsrfToken(cronSecret, extractedToken);
    if (!isValid) {
      return { valid: false, error: 'Invalid cron secret' };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : 'Invalid authorization format';
    return { valid: false, error: message || 'Invalid authorization format' };
  }
}

/**
 * Verifies that request is from Vercel Cron
 * Checks both secret and Vercel deployment ID header
 *
 * @param req - NextRequest object
 * @returns { valid: boolean, error?: string }
 */
export function verifyCron(req: NextRequest): { valid: boolean; error?: string } {
  // Verify secret
  const secretResult = verifyCronSecret(req);
  if (!secretResult.valid) {
    return secretResult;
  }

  // Check Vercel deployment ID header (identifies request from Vercel)
  const xVercelDeploymentId = req.headers.get('x-vercel-deployment-id');
  if (!xVercelDeploymentId) {
    return { valid: false, error: 'Missing Vercel deployment ID header' };
  }

  return { valid: true };
}
