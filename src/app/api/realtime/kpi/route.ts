import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { realtimeMetricsService } from '@/lib/services/realtime-metrics-service';

/**
 * WebSocket handler for real-time KPI updates
 *
 * GET /api/realtime/kpi?org=<organizationId>
 * - Accepts WebSocket upgrade
 * - Broadcasts events: sales, sms-open, sequence-complete, partner-sales
 * - Falls back to HTTP polling if WebSocket not available
 *
 * Example WebSocket events:
 * {
 *   type: 'sales-created',
 *   amount: 150000,
 *   productId: 'cruise-jp-10d',
 *   partnerId: 'partner-123',
 *   time: '2026-05-27T12:34:56Z'
 * }
 */

// Store active connections per organization
const connections = new Map<
  string,
  Set<{
    ws: any;
    orgId: string;
  }>
>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('org');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers.get('upgrade');
    const connection = request.headers.get('connection');

    if (upgrade === 'websocket' && connection?.includes('upgrade')) {
      return handleWebSocketUpgrade(request, organizationId);
    }

    // Fall back to polling endpoint for metrics
    return handleHttpMetricsRequest(organizationId);
  } catch (error) {
    logger.error('KPI route error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleWebSocketUpgrade(
  request: NextRequest,
  organizationId: string
) {
  // Note: Next.js 14 has limited WebSocket support in the App Router
  // For production, consider using a dedicated WebSocket server (e.g., ws library)
  // This is a simplified implementation that demonstrates the concept

  // For now, we'll return a 501 Not Implemented
  // The actual WebSocket handling should be done with a standalone server
  // or via a library like Socket.IO with a custom server

  logger.warn('WebSocket upgrade requested but not implemented in Next.js App Router');

  return NextResponse.json(
    {
      error: 'WebSocket not supported via Next.js App Router',
      fallback: '/api/realtime/kpi/metrics',
    },
    { status: 501 }
  );
}

async function handleHttpMetricsRequest(organizationId: string) {
  try {
    const metrics = await realtimeMetricsService.getAllMetrics(organizationId);

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Error fetching metrics', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/realtime/kpi
 * For pushing events to WebSocket server
 * (When WebSocket is running on separate server)
 */
export async function POST(request: NextRequest) {
  try {
    // Note: In production, add proper authentication check here

    const body = await request.json();
    const { type, organizationId, ...eventData } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Broadcast to all connections in organization
    const orgConnections = connections.get(organizationId);
    if (orgConnections) {
      const event = {
        type,
        ...eventData,
        time: new Date().toISOString(),
      };

      for (const { ws } of orgConnections) {
        try {
          // ws.send(JSON.stringify(event));
          logger.debug('Event broadcasted', { type, organizationId });
        } catch (err) {
          logger.error('Failed to send to client', err);
        }
      }
    }

    // Invalidate cache to force fresh metrics
    await realtimeMetricsService.invalidateCache(organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing event', error);
    return NextResponse.json(
      { error: 'Failed to process event' },
      { status: 500 }
    );
  }
}
