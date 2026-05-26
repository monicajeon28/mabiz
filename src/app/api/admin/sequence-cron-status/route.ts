/**
 * GET /api/admin/sequence-cron-status
 *
 * Sequence Cron Health Check & Status Endpoint
 *
 * Returns:
 * - Last execution time
 * - Sequences processed
 * - Error count
 * - Next scheduled run
 * - Current sequence health by organization
 *
 * Used for:
 * - Monitoring dashboard
 * - Debugging
 * - Observability
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getSequenceHealth } from '@/lib/services/sequence-completion-detector';

export async function GET(req: Request) {
  try {
    // Verify authentication
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // Check if user has admin permissions
    if (ctx.role !== 'admin' && ctx.role !== 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get sequence health for organization
    const health = await getSequenceHealth(orgId);

    // Get recent execution stats
    const recentInstances = await prisma.contactSequenceInstance.findMany({
      where: {
        template: { organizationId: orgId }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        day0SentAt: true,
        day1SentAt: true,
        day2SentAt: true,
        day3SentAt: true,
        updatedAt: true
      }
    });

    // Get active sequence templates
    const templates = await prisma.smsSequenceTemplate.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        psychologyLens: true,
        totalSent: true,
        totalOpened: true,
        totalClicked: true,
        totalConverted: true
      }
    });

    // Calculate cron schedule
    const nextRun = calculateNextRun();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      schedule: {
        interval: '5 minutes',
        pattern: '*/5 * * * *',
        nextRunAt: nextRun,
        timezone: 'UTC'
      },
      health,
      recentActivity: {
        lastUpdated: recentInstances[0]?.updatedAt || null,
        recentInstances: recentInstances.map((inst) => ({
          status: inst.status,
          daysSent: [
            inst.day0SentAt ? 0 : null,
            inst.day1SentAt ? 1 : null,
            inst.day2SentAt ? 2 : null,
            inst.day3SentAt ? 3 : null
          ].filter((d) => d !== null),
          updatedAt: inst.updatedAt
        }))
      },
      activeSequences: {
        count: templates.length,
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          lens: t.psychologyLens,
          performance: {
            sent: t.totalSent,
            opened: t.totalOpened,
            clicked: t.totalClicked,
            converted: t.totalConverted,
            openRate: t.totalSent > 0 ? ((t.totalOpened / t.totalSent) * 100).toFixed(1) + '%' : '0%',
            clickRate: t.totalSent > 0 ? ((t.totalClicked / t.totalSent) * 100).toFixed(1) + '%' : '0%',
            convertRate: t.totalSent > 0
              ? ((t.totalConverted / t.totalSent) * 100).toFixed(1) + '%'
              : '0%'
          }
        }))
      }
    });
  } catch (error) {
    logger.error('[sequence-cron-status] Error getting status', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate next scheduled run time
 * Based on every 5 minutes
 */
function calculateNextRun(): string {
  const now = new Date();
  const nextRun = new Date(now);

  // Round up to next 5-minute interval
  const minutes = nextRun.getMinutes();
  const remainingMinutes = 5 - (minutes % 5);

  if (remainingMinutes === 0) {
    nextRun.setMinutes(nextRun.getMinutes() + 5);
  } else {
    nextRun.setMinutes(nextRun.getMinutes() + remainingMinutes);
  }

  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);

  return nextRun.toISOString();
}
