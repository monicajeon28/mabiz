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
import { parseRequestBody, isValidArray } from '@/lib/utils/json-parser';

interface ScenarioRequest {
  changes: ScenarioChange[];
}

/**
 * Type guard for ScenarioRequest validation
 */
function isScenarioRequest(data: unknown): data is ScenarioRequest {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'changes' in obj && isValidArray<ScenarioChange>(obj.changes);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const session = await getAuthSession();
    if (!session?.userId) {
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

    // 3. Parse request body with type validation
    const rawBody = await request.json();
    if (!isScenarioRequest(rawBody)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const body = rawBody as ScenarioRequest;

    if (!body.changes || body.changes.length === 0) {
      return NextResponse.json(
        { error: 'At least one scenario change required' },
        { status: 400 }
      );
    }

    // 4. Validate changes with type safety
    const VALID_CHANGE_TYPES = [
      'sms_volume_increase',
      'new_sequence',
      'partner_commission',
      'marketing_channel',
      'pricing',
      'conversion_lift',
      'channel_shift',
    ] as const;

    const isValidChangeType = (type: unknown): type is typeof VALID_CHANGE_TYPES[number] => {
      return VALID_CHANGE_TYPES.includes(type as typeof VALID_CHANGE_TYPES[number]);
    };

    const isValidChangeValue = (value: unknown): value is number => {
      return typeof value === 'number' && value >= 0 && value <= 200;
    };

    for (const change of body.changes) {
      if (!isValidChangeType(change.type)) {
        return NextResponse.json(
          {
            error: `Invalid change type: ${change.type}`,
            validTypes: VALID_CHANGE_TYPES,
          },
          { status: 400 }
        );
      }

      if (!isValidChangeValue(change.value)) {
        return NextResponse.json(
          { error: 'Change value must be a number between 0 and 200' },
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
