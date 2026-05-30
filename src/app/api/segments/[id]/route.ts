/**
 * GET /api/segments/[id] - Get segment details
 * GET /api/segments/[id]/contacts - Get contacts in segment
 * GET /api/segments/[id]/recommendation - Get campaign recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      // TODO: Implement once CustomerSegment model is re-enabled in schema.prisma
      // This endpoint should return contacts assigned to the segment
      return NextResponse.json({
        success: true,
        total: 0,
        contacts: [],
        message: "CustomerSegment functionality disabled - awaiting schema update"
      });
    }

    // GET /api/segments/[id]/recommendation
    if (path.endsWith("/recommendation")) {
      // TODO: Implement once segmentation engine is re-enabled
      // This endpoint should recommend campaigns based on segment profile
      return NextResponse.json({
        success: true,
        recommendation: null,
        suggestedABTest: null,
        message: "Campaign recommendation disabled - awaiting schema update"
      });
    }

    // GET /api/segments/[id] - Default: segment details
    return NextResponse.json({
      success: true,
      segment: {
        id: segmentId,
        name: "Placeholder Segment",
        size: 0,
        profile: null,
        status: "DISABLED"
      },
      message: "CustomerSegment functionality disabled - awaiting schema update"
    });
  } catch (error) {
    console.error("[GET /api/segments/[id]]", error);
    return NextResponse.json(
      { error: "Failed to fetch segment details" },
      { status: 500 }
    );
  }
}
