/**
 * POST /api/customers/batch-lenses
 *
 * Get lens detection for multiple contacts at once
 * Performance optimized for bulk operations
 *
 * Request body:
 * {
 *   "contactIds": ["id1", "id2", "id3", ...],
 *   "orgId": "org123"
 * }
 *
 * Returns:
 * {
 *   "results": {
 *     "id1": { lenses: [...], riskScore, riskLevel },
 *     "id2": { ... }
 *   },
 *   "duration_ms": 1234
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectCustomerLensesBatch } from "@/lib/customers/lens-detector";
import { logger } from "@/lib/logger";
import { getMabizSession } from "@/lib/auth";

interface BatchLensRequest {
  contactIds: string[];
  orgId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BatchLensRequest = await request.json();
    const { contactIds } = body;
    // GLOBAL_ADMIN: body orgId 허용, 일반: 세션 org 고정
    const orgId = session.role === 'GLOBAL_ADMIN'
      ? (body.orgId || session.organizationId || '')
      : (session.organizationId || '');

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Limit batch size
    if (contactIds.length > 200) {
      return NextResponse.json(
        { error: "Maximum 200 contacts per batch" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Fetch all contacts in batch
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        organizationId: orgId,
      },
    });

    // Detect lenses for all contacts in a single batch (3 DB queries total)
    const results: Record<string, any> = {};

    const batchLenses = await detectCustomerLensesBatch(contacts, orgId);

    for (const contact of contacts) {
      const lenses = batchLenses[contact.id] ?? [];

      // Calculate risk score
      let riskScore = 0;
      if (contact.lastContactedAt) {
        const daysSinceContact = Math.floor(
          (Date.now() - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact > 180) riskScore += 25;
        else if (daysSinceContact > 90) riskScore += 15;
      }

      if (contact.tags?.includes("price_sensitive")) riskScore += 20;
      if (contact.optOutAt) riskScore += 30;

      const readyLens = lenses.find((l) => l.readinessScore > 70);
      if (readyLens) riskScore = Math.max(0, riskScore - 10);

      riskScore = Math.min(100, riskScore);

      results[contact.id] = {
        name: contact.name,
        phone: contact.phone,
        lenses: lenses.map((l) => ({
          lensType: l.lensType,
          label: l.label,
          confidenceScore: l.confidenceScore,
          readinessScore: l.readinessScore,
          signals: l.signals,
        })),
        riskScore,
        riskLevel:
          riskScore >= 80
            ? "CRITICAL"
            : riskScore >= 60
              ? "HIGH"
              : riskScore >= 40
                ? "MEDIUM"
                : "LOW",
        primaryLens: lenses[0]
          ? {
              lensType: lenses[0].lensType,
              label: lenses[0].label,
              confidence: lenses[0].confidenceScore,
            }
          : null,
      };
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      results,
      meta: {
        processedCount: Object.keys(results).length,
        totalRequested: contactIds.length,
        duration_ms: duration,
        avgMs: Math.round(duration / contactIds.length),
      },
    });
  } catch (error) {
    logger.error("[Batch Lens] Error:", error);
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
