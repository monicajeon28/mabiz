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

import { NextResponse } from 'next/server';
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
    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const org of organizations) {
      try {
        const result = await processOnboardingSequence(org.id);
        response.organizationsProcessed++;
        response.day1Sent += result.day1Sent;
        response.day3Sent += result.day3Sent;
        response.day7Sent += result.day7Sent;
        response.day14Sent += result.day14Sent;
        response.completed += result.completed;

        if (result.errors.length > 0) {
          response.errors.push(
            ...result.errors.map((err) => ({
              organizationId: org.id,
              error: err,
            }))
          );
        }
      } catch (err) {
        response.errors.push({
          organizationId: org.id,
          error: String(err),
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
