/**
 * Partner Onboarding Cron
 *
 * POST /api/cron/partner-onboarding
 *
 * Runs daily at 8 AM to send onboarding emails:
 * - Day 1: Welcome + quick start guide
 * - Day 3: 3 success tips
 * - Day 7: First milestone celebration
 * - Day 14: Next steps + resources
 *
 * Processes all partners in ONBOARDING status
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { processOnboardingSequence } from '@/lib/services/partner-onboarding-service';

interface OnboardingCronResponse {
  status: string;
  timestamp: string;
  organizationsProcessed: number;
  day1Sent: number;
  day3Sent: number;
  day7Sent: number;
  day14Sent: number;
  completed: number;
  errors: Array<{
    organizationId: string;
    error: string;
  }>;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  const response: OnboardingCronResponse = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    organizationsProcessed: 0,
    day1Sent: 0,
    day3Sent: 0,
    day7Sent: 0,
    day14Sent: 0,
    completed: 0,
    errors: [],
  };

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    const cronSecret = authHeader?.replace('Bearer ', '');
    const envSecret = process.env.CRON_SECRET;
    if (!envSecret) {
      return NextResponse.json(
        { error: 'Service Unavailable' },
        { status: 503 }
      );
    }
    if (!cronSecret ||
        cronSecret.length !== envSecret.length ||
        !timingSafeEqual(Buffer.from(cronSecret), Buffer.from(envSecret))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    if (!organizations || organizations.length === 0) {
      logger.warn('No active organizations found for onboarding');
      response.status = 'SUCCESS';
      return NextResponse.json(response, { status: 200 });
    }

    for (const org of organizations) {
      try {
        const result = await processOnboardingSequence(org.id);

        response.organizationsProcessed += 1;
        response.day1Sent += result?.day1Sent || 0;
        response.day3Sent += result?.day3Sent || 0;
        response.day7Sent += result?.day7Sent || 0;
        response.day14Sent += result?.day14Sent || 0;
        response.completed += result?.completed || 0;

        if (result?.errors && result.errors.length > 0) {
          response.errors.push(
            ...result.errors.map((err: string) => ({
              organizationId: org.id,
              error: err,
            }))
          );
        }
      } catch (err) {
        response.errors.push({
          organizationId: org.id,
          error: '처리 중 오류가 발생했습니다.',
        });
        logger.error('Error processing organization onboarding', {
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
    logger.error('Partner onboarding cron failed', { err });
  }

  const duration = Date.now() - startTime;
  logger.info('Partner onboarding cron completed', {
    status: response.status,
    duration: `${duration}ms`,
    organizationsProcessed: response.organizationsProcessed,
    emailsSent: {
      day1: response.day1Sent,
      day3: response.day3Sent,
      day7: response.day7Sent,
      day14: response.day14Sent,
    },
  });

  return NextResponse.json(response, {
    status: response.status === 'SUCCESS' ? 200 : 500,
  });
}
