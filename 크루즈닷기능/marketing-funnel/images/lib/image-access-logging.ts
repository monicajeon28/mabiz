import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';

export type ImageAccessAction =
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'VIEW'
  | 'DELETE'
  | 'UPDATE'
  | 'SHARE'
  | 'DUPLICATE';

/**
 * Log image access for audit trail
 * Non-blocking: failures are logged but not thrown
 */
export async function logImageAccess(
  productImageId: number,
  action: ImageAccessAction,
  options?: {
    userId?: number;
    request?: NextRequest;
    metadata?: Record<string, any>;
  }
) {
  try {
    const ipAddress = options?.request?.headers?.get('x-forwarded-for') ||
                      options?.request?.headers?.get('x-real-ip') ||
                      options?.request?.ip ||
                      undefined;

    const userAgent = options?.request?.headers?.get('user-agent') || undefined;

    await prisma.imageAccessLog.create({
      data: {
        productImageId,
        action,
        userId: options?.userId,
        ipAddress: ipAddress?.split(',')[0].trim(),
        userAgent: userAgent?.slice(0, 500),
        metadata: options?.metadata,
      },
    });
  } catch (err) {
    // Non-blocking: log but don't throw
    logger.warn('[Image Access Log] Failed to log access:', {
      productImageId,
      action,
      error: err instanceof Error ? err.message : err,
    });
  }
}

/**
 * Get access statistics for an image
 */
export async function getImageAccessStats(productImageId: number) {
  try {
    const stats = await prisma.imageAccessLog.groupBy({
      by: ['action'],
      where: { productImageId },
      _count: { id: true },
    });

    const totalAccess = await prisma.imageAccessLog.count({
      where: { productImageId },
    });

    return {
      totalAccess,
      byAction: Object.fromEntries(
        stats.map(s => [s.action, s._count.id])
      ),
    };
  } catch (err) {
    logger.error('[Image Access Stats] Error:', {
      productImageId,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}
