/**
 * Partner Risk Scoring Cron
 *
 * POST /api/cron/partner-risk-scoring
 *
 * Runs daily at 9 AM to calculate churn risk for all partners
 * Updates risk scores and identifies partners needing intervention
 *
 * Risk Levels:
 * - GREEN (0-3): Healthy
 * - YELLOW (4-6): At-risk
 * - RED (7+): Critical
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateAllPartnerChurnRisks } from '@/lib/services/partner-churn-detector';

interface RiskScoringResponse {
  status: string;
  timestamp: string;
  organizationsProcessed: number;
  totalPartnersScored: number;
  riskDistribution: {
    GREEN: number;
    YELLOW: number;
    RED: number;
  };
  changedToRed: number;
  changedToYellow: number;
  improved: number;
  errors: Array<{
    organizationId: string;
    error: string;
  }>;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const response: RiskScoringResponse = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    organizationsProcessed: 0,
    totalPartnersScored: 0,
    riskDistribution: {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
    },
    changedToRed: 0,
    changedToYellow: 0,
    improved: 0,
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
        const result = await calculateAllPartnerChurnRisks(org.id);

        response.organizationsProcessed++;
        response.totalPartnersScored += result.processed;
        response.riskDistribution.GREEN += result.byRiskLevel.GREEN;
        response.riskDistribution.YELLOW += result.byRiskLevel.YELLOW;
        response.riskDistribution.RED += result.byRiskLevel.RED;
        response.changedToRed += result.changedToRed.length;
        response.changedToYellow += result.changedToYellow.length;
        response.improved += result.improved.length;

        if (result.errors.length > 0) {
          response.errors.push(
            ...result.errors.map((err) => ({
              organizationId: org.id,
              error: err,
            }))
          );
        }

        logger.info('Risk scoring completed for organization', {
          organizationId: org.id,
          processed: result.processed,
          riskDistribution: result.byRiskLevel,
          changedToRed: result.changedToRed.length,
        });
      } catch (err) {
        response.errors.push({
          organizationId: org.id,
          error: String(err),
        });
        logger.error('Error processing organization risk scoring', {
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
    logger.error('Partner risk scoring cron failed', { err });
  }

  const duration = Date.now() - startTime;
  logger.info('Partner risk scoring cron completed', {
    status: response.status,
    duration: `${duration}ms`,
    partnersScored: response.totalPartnersScored,
    riskDistribution: response.riskDistribution,
  });

  return NextResponse.json(response, {
    status: response.status === 'SUCCESS' ? 200 : 500,
  });
}
