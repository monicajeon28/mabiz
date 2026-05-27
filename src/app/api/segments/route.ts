/**
 * GET /api/segments - List all segments with profiles
 * POST /api/segments/refresh - Trigger re-clustering
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSegmentation, triggerReclustering } from "@/lib/ai/segmentation-engine";

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get("x-organization-id");

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      );
    }

    const segments = await prisma.customerSegment.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      include: {
        contactSegmentAssignments: {
          select: { id: true },
        },
        segmentCampaignMetrics: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { size: "desc" },
    });

    return NextResponse.json({
      success: true,
      total: segments.length,
      segments: segments.map((seg) => ({
        id: seg.id,
        name: seg.name,
        size: seg.size,
        churnRisk: seg.churnRiskPercent,
        avgLtv: seg.avgLtv,
        avgEngagement: seg.avgEngagementRate,
        predictedConversion: seg.predictedConversionRate,
        profile: seg.profile,
        contactCount: seg.contactSegmentAssignments.length,
        lastClustered: seg.lastClusteredAt,
        recentCampaigns: seg.segmentCampaignMetrics.length,
      })),
    });
  } catch (error) {
    console.error("[GET /api/segments]", error);
    return NextResponse.json(
      { error: "Failed to fetch segments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get("x-organization-id");
    const body = await request.json();

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      );
    }

    if (body.action === "refresh") {
      // Trigger re-clustering
      const result = await triggerReclustering(orgId);

      return NextResponse.json({
        success: true,
        message: "Re-clustering triggered",
        totalContacts: result.totalContacts,
        segmentCount: result.segments.length,
        convergenceStatus: result.convergenceStatus,
      });
    } else if (body.action === "create-initial") {
      // Create initial segmentation (k=5 segments)
      const result = await runSegmentation(orgId, 5);

      return NextResponse.json({
        success: true,
        message: "Initial segmentation completed",
        totalContacts: result.totalContacts,
        segmentCount: result.segments.length,
        convergenceStatus: result.convergenceStatus,
        segments: result.segments.map((seg: any) => ({
          id: seg.id,
          name: seg.name,
          size: seg.size,
        })),
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[POST /api/segments]", error);
    return NextResponse.json(
      { error: "Failed to process segmentation" },
      { status: 500 }
    );
  }
}
