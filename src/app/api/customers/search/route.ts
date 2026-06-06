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
 * - limit: Default 50
 * - offset: Default 0
 * - orgId: Organization context
 */

import { NextRequest, NextResponse } from "next/server";
import { getCustomers360 } from "@/lib/customers/customer-aggregator";
import { maskCustomer360, UserRole } from "@/lib/customers/pii-masker";
import { getServerSession } from "next-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = (request.nextUrl.searchParams.get("orgId") ||
      (typeof session === 'object' && session !== null && 'user' in session ? (session as { user?: { organizationId?: string } }).user?.organizationId : undefined)) as string;

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
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");
    const maskLevel = (request.nextUrl.searchParams.get("maskLevel") || "AGENT") as UserRole;

    const startTime = Date.now();

    // Get customers with filters
    const { customers, total } = await getCustomers360(organizationId, {
      searchQuery: searchQuery || undefined,
      riskLevel: riskLevel || undefined,
      lensType: lensType || undefined,
      groupId: groupId || undefined,
      limit,
      offset,
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
        offset,
        hasMore: offset + limit < total,
      },
      meta: {
        duration_ms: duration,
        maskLevel,
      },
    });
  } catch (error) {
    console.error("[Customer Search] Error:", error);
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
