/**
 * GET /api/segments - List all segments with profiles
 * POST /api/segments/refresh - Trigger re-clustering
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // TODO: Implement once CustomerSegment model is re-enabled in schema.prisma
  // This endpoint should list all active segments with their metrics
  return NextResponse.json({
    success: true,
    total: 0,
    segments: [],
    message: "CustomerSegment functionality disabled - awaiting schema update"
  });
}

export async function POST(request: NextRequest) {
  // TODO: Implement once CustomerSegment model is re-enabled in schema.prisma
  // This endpoint should trigger re-clustering/refresh of segments
  return NextResponse.json({
    success: true,
    message: "CustomerSegment functionality disabled - awaiting schema update"
  });
}
