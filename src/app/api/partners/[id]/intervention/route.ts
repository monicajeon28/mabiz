/**
 * POST /api/partners/[id]/intervention
 *
 * Manually trigger intervention for a partner
 *
 * Query params:
 * - type: "GREEN" | "YELLOW" | "RED"
 * - organizationId: required
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  sendGreenIntervention,
  sendYellowIntervention,
  sendRedIntervention,
} from '@/lib/services/partner-intervention-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const partnerId = params.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'GREEN' | 'YELLOW' | 'RED';
    const organizationId = searchParams.get('organizationId');

    if (!type || !organizationId) {
      return NextResponse.json(
        { error: 'type and organizationId are required' },
        { status: 400 }
      );
    }

    // Verify partner exists and belongs to organization
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner || partner.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    let result;

    try {
      if (type === 'GREEN') {
        result = await sendGreenIntervention(partnerId, organizationId);
      } else if (type === 'YELLOW') {
        const actions = await sendYellowIntervention(partnerId, organizationId);
        result = {
          type: 'YELLOW',
          partnerId,
          riskLevel: 'YELLOW',
          message: 'YELLOW interventions sent',
          actions,
        };
      } else if (type === 'RED') {
        const actions = await sendRedIntervention(partnerId, organizationId);
        result = {
          type: 'RED',
          partnerId,
          riskLevel: 'RED',
          message: 'RED interventions sent',
          actions,
        };
      }
    } catch (err) {
      logger.error('Error sending intervention', {
        partnerId,
        type,
        err,
      });
      return NextResponse.json(
        { error: `Failed to send ${type} intervention` },
        { status: 500 }
      );
    }

    logger.info('Manual intervention triggered', {
      partnerId,
      type,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    logger.error('Error processing intervention request', { err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
