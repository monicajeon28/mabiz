/**
 * POST /api/forecast/scenario
 *
 * Run "what-if" analysis for scenario planning
 *
 * Request body:
 * {
 *   "changes": [
 *     { "type": "sms_volume_increase", "value": 20, "description": "Increase SMS by 20%" },
 *     { "type": "new_sequence", "value": 15, "description": "New Day 0-3 sequence" }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { predictWithScenario, ScenarioChange } from '@/lib/services/scenario-planner';
import { getAuthSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface ScenarioRequest {
  changes: ScenarioChange[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get organization
    const organizationId = request.headers.get('x-organization-id');
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const body: ScenarioRequest = await request.json();

    if (!body.changes || !Array.isArray(body.changes) || body.changes.length === 0) {
      return NextResponse.json(
        { error: 'At least one scenario change required' },
        { status: 400 }
      );
    }

    // 4. Validate changes
    const validTypes = [
      'sms_volume_increase',
      'new_sequence',
      'partner_commission',
      'marketing_channel',
      'pricing',
      'conversion_lift',
      'channel_shift',
    ];

    for (const change of body.changes) {
      if (!validTypes.includes(change.type)) {
        return NextResponse.json(
          {
            error: `Invalid change type: ${change.type}`,
            validTypes,
          },
          { status: 400 }
        );
      }

      if (typeof change.value !== 'number' || change.value < 0 || change.value > 200) {
        return NextResponse.json(
          { error: 'Change value must be between 0 and 200' },
          { status: 400 }
        );
      }
    }

    // 5. Run scenario
    const result = await predictWithScenario(organizationId, body.changes);

    // 6. Return result
    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'no-cache'); // Don't cache scenario results

    logger.info(`Scenario analysis for ${organizationId}`, {
      changeCount: body.changes.length,
      revenue7DDelta: result.analysis.revenue7DayDelta,
    });

    return response;
  } catch (error) {
    logger.error('Scenario planning endpoint error', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to run scenario analysis',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
