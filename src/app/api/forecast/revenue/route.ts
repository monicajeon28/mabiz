/**
 * GET /api/forecast/revenue?days=7
 *
 * Returns revenue forecast for specified number of days
 * Includes confidence intervals and detailed breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { forecastRevenue } from '@/lib/ai/revenue-forecaster';
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
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30')));

    // 4. Generate forecast
    const forecast = await forecastRevenue(organizationId, days);

    // 5. Return with cache headers
    const response = NextResponse.json(forecast);
    response.headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    logger.info(`Revenue forecast requested for ${organizationId}`, { days });

    return response;
  } catch (error) {
    logger.error('Revenue forecast endpoint error', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to generate forecast',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
