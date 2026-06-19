/**
 * Partner Interventions Cron
 *
 * POST /api/cron/partner-interventions
 *
 * Runs daily at 10 AM to send automatic interventions based on risk level
 *
 * - GREEN: Weekly newsletter
 * - YELLOW: "We miss you" message + incentive
 * - RED: Urgent outreach + special offer + dedicated support
 */

export const runtime = 'nodejs';

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendAutoInterventions } from '@/lib/services/partner-intervention-service';

interface InterventionCronResponse {
  status: string;
  timestamp: string;
  interventionsByRiskLevel: {
    GREEN: {
      sent: number;
      failed: number;
    };
    YELLOW: {
      sent: number;
      failed: number;
    };
    RED: {
      sent: number;
      failed: number;
    };
  };
  totalActionsTaken: number;
  errors: string[];
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
  const response: InterventionCronResponse = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    interventionsByRiskLevel: {
      GREEN: { sent: 0, failed: 0 },
      YELLOW: { sent: 0, failed: 0 },
      RED: { sent: 0, failed: 0 },
    },
    totalActionsTaken: 0,
    errors: [],
  };

  try {
    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    // Send GREEN interventions (newsletters)
    for (const org of organizations) {
      try {
        const greenResult = await sendAutoInterventions('GREEN', org.id);
        response.interventionsByRiskLevel.GREEN.sent += greenResult.successful;
        response.interventionsByRiskLevel.GREEN.failed += greenResult.failed;
        response.totalActionsTaken += greenResult.actions.length;

        if (greenResult.errors.length > 0) {
          response.errors.push(
            ...greenResult.errors.map((e) => `GREEN/${org.id}: ${e}`)
          );
        }
      } catch (err) {
        response.errors.push(`GREEN/${org.id}: ${String(err)}`);
        logger.error('Error sending GREEN interventions', { organizationId: org.id, err });
      }
    }

    // Send YELLOW interventions (encouragement + incentive)
    for (const org of organizations) {
      try {
        const yellowResult = await sendAutoInterventions('YELLOW', org.id);
        response.interventionsByRiskLevel.YELLOW.sent += yellowResult.successful;
        response.interventionsByRiskLevel.YELLOW.failed += yellowResult.failed;
        response.totalActionsTaken += yellowResult.actions.length;

        if (yellowResult.errors.length > 0) {
          response.errors.push(
            ...yellowResult.errors.map((e) => `YELLOW/${org.id}: ${e}`)
          );
        }
      } catch (err) {
        response.errors.push(`YELLOW/${org.id}: ${String(err)}`);
        logger.error('Error sending YELLOW interventions', { organizationId: org.id, err });
      }
    }

    // Send RED interventions (urgent outreach)
    for (const org of organizations) {
      try {
        const redResult = await sendAutoInterventions('RED', org.id);
        response.interventionsByRiskLevel.RED.sent += redResult.successful;
        response.interventionsByRiskLevel.RED.failed += redResult.failed;
        response.totalActionsTaken += redResult.actions.length;

        if (redResult.errors.length > 0) {
          response.errors.push(
            ...redResult.errors.map((e) => `RED/${org.id}: ${e}`)
          );
        }
      } catch (err) {
        response.errors.push(`RED/${org.id}: ${String(err)}`);
        logger.error('Error sending RED interventions', { organizationId: org.id, err });
      }
    }

    response.status = 'SUCCESS';
  } catch (err) {
    response.status = 'FAILED';
    response.errors.push(String(err));
    logger.error('Partner interventions cron failed', { err });
  }

  const duration = Date.now() - startTime;
  logger.info('Partner interventions cron completed', {
    status: response.status,
    duration: `${duration}ms`,
    interventionsSent: {
      GREEN: response.interventionsByRiskLevel.GREEN.sent,
      YELLOW: response.interventionsByRiskLevel.YELLOW.sent,
      RED: response.interventionsByRiskLevel.RED.sent,
    },
    totalActions: response.totalActionsTaken,
  });

  return NextResponse.json(response, {
    status: response.status === 'SUCCESS' ? 200 : 500,
  });
}
