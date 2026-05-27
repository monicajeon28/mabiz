/**
 * GET /api/segments/[id] - Get segment details
 * GET /api/segments/[id]/contacts - Get contacts in segment
 * GET /api/segments/[id]/recommendation - Get campaign recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSegmentDetails,
  recommendCampaignBySegment,
} from "@/lib/ai/segmentation-engine";
import { recommendCampaignBySegment as getCampaignRec } from "@/lib/services/segment-campaigns";
import { suggestABTestForSegment } from "@/lib/services/segment-campaigns";

interface RouteParams {
  params: {
    id: string;
  };
  searchParams?: Record<string, string>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = request.headers.get("x-organization-id");
    const path = request.nextUrl.pathname;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      );
    }

    const segmentId = params.id;

    // GET /api/segments/[id]/contacts
    if (path.endsWith("/contacts")) {
      const contacts = await prisma.contactSegmentAssignment.findMany({
        where: {
          segmentId,
          organizationId: orgId,
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              ageInYears: true,
              vipStatus: true,
              ltvTotal: true,
              leadScore: true,
            },
          },
        },
        orderBy: { probability: "desc" },
        take: 100,
      });

      return NextResponse.json({
        success: true,
        total: contacts.length,
        contacts: contacts.map((c) => ({
          id: c.contact.id,
          name: c.contact.name,
          phone: c.contact.phone,
          email: c.contact.email,
          age: c.contact.ageInYears,
          vipStatus: c.contact.vipStatus,
          ltv: c.contact.ltvTotal,
          leadScore: c.contact.leadScore,
          probability: c.probability,
          explanation: c.explanation,
        })),
      });
    }

    // GET /api/segments/[id]/recommendation
    if (path.endsWith("/recommendation")) {
      const recommendation = await getCampaignRec(segmentId, orgId);
      const abTest = await suggestABTestForSegment(segmentId, orgId);

      return NextResponse.json({
        success: true,
        recommendation,
        suggestedABTest: abTest,
      });
    }

    // GET /api/segments/[id] - Default: segment details
    const segment = await getSegmentDetails(segmentId);

    if (!segment) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      segment: {
        id: segment.id,
        name: segment.name,
        profile: segment.profile,
        size: segment.size,
        churnRisk: segment.churnRiskPercent,
        avgLtv: segment.avgLtv,
        avgEngagement: segment.avgEngagementRate,
        predictedConversion: segment.predictedConversionRate,
        contactCount: segment.contactSegmentAssignments.length,
        recentCampaigns: segment.segmentCampaignMetrics.length,
        lastClustered: segment.lastClusteredAt,
        nextClustering: segment.nextClusteringAt,
      },
    });
  } catch (error) {
    console.error("[GET /api/segments/[id]]", error);
    return NextResponse.json(
      { error: "Failed to fetch segment details" },
      { status: 500 }
    );
  }
}
