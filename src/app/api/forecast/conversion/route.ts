/**
 * GET /api/forecast/conversion?period=30
 *
 * Returns conversion rate forecast for specified period
 * Includes breakdown by channel, segment, and psychology lens
 */

import { NextRequest, NextResponse } from 'next/server';
import { forecastConversion } from '@/lib/ai/conversion-forecaster';
import { getAuthSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get organization from context
    const organizationId = request.headers.get('x-organization-id');
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = Math.min(90, Math.max(7, parseInt(searchParams.get('period') || '30')));

    // 4. Generate conversion forecast
    const forecast = await forecastConversion(organizationId, period);

    // 5. Return with cache headers
    const response = NextResponse.json(forecast);
    response.headers.set('Cache-Control', 'public, max-age=3600');

    logger.info(`Conversion forecast requested for ${organizationId}`, { period });

    return response;
  } catch (error) {
    logger.error('Conversion forecast endpoint error', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to generate conversion forecast',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
