/**
 * GET /api/segments - List all segments with profiles
 * POST /api/segments/refresh - Trigger re-clustering
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "CustomerSegment functionality has been disabled" },
    { status: 503 }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "CustomerSegment functionality has been disabled" },
    { status: 503 }
  );
}
