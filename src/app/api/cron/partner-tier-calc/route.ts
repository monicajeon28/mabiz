/**
 * Partner Tier Calculation Cron
 *
 * POST /api/cron/partner-tier-calc
 *
 * Runs on the 1st of each month at 8 AM to recalculate partner tiers
 * based on monthly commission
 *
 * Tier System:
 * - Tier 1 (Platinum): >$20K/month (25% commission + quarterly bonus)
 * - Tier 2 (Gold): $5K-$20K/month (21% commission)
 * - Tier 3 (Silver): $1K-$5K/month (18% commission)
 * - Tier 4 (Bronze): <$1K/month (15% commission)
 */

export const runtime = 'nodejs';

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateAllPartnerTiers } from '@/lib/services/partner-tier-service';

interface TierCalcResponse {
  status: string;
  timestamp: string;
  organizationsProcessed: number;
  tierCounts: {
    Tier1: number;
    Tier2: number;
    Tier3: number;
    Tier4: number;
  };
  promoted: number;
  demoted: number;
  errors: Array<{
    organizationId: string;
    error: string;
  }>;
}

export async function POST(req: Request) {
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');
  if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const response: TierCalcResponse = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    organizationsProcessed: 0,
    tierCounts: {
      Tier1: 0,
      Tier2: 0,
      Tier3: 0,
      Tier4: 0,
    },
    promoted: 0,
    demoted: 0,
    errors: [],
  };

  try {
    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const org of organizations) {
      try {
        const result = await calculateAllPartnerTiers(org.id);

        response.organizationsProcessed++;
        response.tierCounts.Tier1 += result.tierCounts.Tier1;
        response.tierCounts.Tier2 += result.tierCounts.Tier2;
        response.tierCounts.Tier3 += result.tierCounts.Tier3;
        response.tierCounts.Tier4 += result.tierCounts.Tier4;
        response.promoted += result.tierPromoted.length;
        response.demoted += result.tierDemoted.length;

        if (result.errors.length > 0) {
          response.errors.push(
            ...result.errors.map((err) => ({
              organizationId: org.id,
              error: err,
            }))
          );
        }

        // Log tier changes
        if (result.tierPromoted.length > 0) {
          logger.info('Partners promoted', {
            organizationId: org.id,
            promoted: result.tierPromoted,
          });
        }

        if (result.tierDemoted.length > 0) {
          logger.info('Partners demoted', {
            organizationId: org.id,
            demoted: result.tierDemoted,
          });
        }
      } catch (err) {
        response.errors.push({
          organizationId: org.id,
          error: '처리 중 오류가 발생했습니다.',
        });
        logger.error('Error calculating partner tiers', {
          organizationId: org.id,
          err,
        });
      }
    }

    response.status = 'SUCCESS';
  } catch (err) {
    response.status = 'FAILED';
    response.errors.push({
      organizationId: 'SYSTEM',
      error: String(err),
    });
    logger.error('Partner tier calculation cron failed', { err });
  }

  const duration = Date.now() - startTime;
  logger.info('Partner tier calculation cron completed', {
    status: response.status,
    duration: `${duration}ms`,
    organizationsProcessed: response.organizationsProcessed,
    tierDistribution: response.tierCounts,
    promoted: response.promoted,
    demoted: response.demoted,
  });

  return NextResponse.json(response, {
    status: response.status === 'SUCCESS' ? 200 : 500,
  });
}
