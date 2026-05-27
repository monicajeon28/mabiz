/**
 * GET /api/forecast/anomalies?lookback=7
 *
 * Detect anomalies in actual performance vs forecast
 * Returns root cause analysis and action items
 */

import { NextRequest, NextResponse } from 'next/server';
import { forecastRevenue } from '@/lib/ai/revenue-forecaster';
import { detectAnomalies } from '@/lib/ai/forecast-anomaly-detector';
import { getAuthSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const lookback = Math.min(90, Math.max(1, parseInt(searchParams.get('lookback') || '7')));

    // 4. Get forecast and detect anomalies
    const forecast = await forecastRevenue(organizationId, lookback);
    const report = await detectAnomalies(organizationId, forecast, lookback);

    // 5. Return report
    const response = NextResponse.json(report);
    response.headers.set('Cache-Control', 'public, max-age=1800'); // Cache for 30 minutes

    logger.info(`Anomaly detection for ${organizationId}`, {
      lookback,
      anomaliesFound: report.anomalies.length,
    });

    return response;
  } catch (error) {
    logger.error('Anomaly detection endpoint error', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to detect anomalies',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
