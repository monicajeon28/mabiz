/**
 * GET /api/customers/search
 *
 * Search and filter customers with 360° view
 *
 * Query params:
 * - q: Search query (name, phone, email)
 * - riskLevel: LOW|MEDIUM|HIGH|CRITICAL
 * - lensType: L0|L1|...|L10
 * - groupId: Filter by group membership
 * - limit: Default 50, max 200
 * - cursor: Last item ID from previous page (cursor-based pagination)
 * - orgId: Organization context
 */

import { NextRequest, NextResponse } from "next/server";
import { getCustomers360 } from "@/lib/customers/customer-aggregator";
import { maskCustomer360, UserRole } from "@/lib/customers/pii-masker";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // GLOBAL_ADMIN: query param 허용, 일반: 세션 org 고정
    const organizationId = (session.role === 'GLOBAL_ADMIN'
      ? (request.nextUrl.searchParams.get("orgId") || session.organizationId)
      : session.organizationId) as string;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization context missing" },
        { status: 400 }
      );
    }

    // Query parameters
    const searchQuery = request.nextUrl.searchParams.get("q");
    const riskLevel = request.nextUrl.searchParams.get("riskLevel") as
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL"
      | null;
    const lensType = request.nextUrl.searchParams.get("lensType");
    const groupId = request.nextUrl.searchParams.get("groupId");
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 200);
    const cursor = request.nextUrl.searchParams.get("cursor") || undefined;
    const maskLevel = (request.nextUrl.searchParams.get("maskLevel") || "AGENT") as UserRole;

    const startTime = Date.now();

    // Get customers with cursor-based pagination
    const { customers, total, nextCursor, hasNextPage } = await getCustomers360(organizationId, {
      searchQuery: searchQuery || undefined,
      riskLevel: riskLevel || undefined,
      lensType: lensType || undefined,
      groupId: groupId || undefined,
      limit,
      cursor,
    });

    // Apply masking
    const masked = customers.map((customer) => maskCustomer360(customer, maskLevel));

    const duration = Date.now() - startTime;

    return NextResponse.json({
      data: masked.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        primaryLens: c.primaryLens,
        riskScore: c.riskScore,
        riskLevel: c.riskLevel,
        lastInteractionAt: c.lastInteractionAt,
        type: c.type,
      })),
      pagination: {
        total,
        limit,
        nextCursor,
        hasNextPage,
      },
      meta: {
        duration_ms: duration,
        maskLevel,
      },
    });
  } catch (error) {
    logger.error("[Customer Search] Error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
