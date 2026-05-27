import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { detectRiskFlags, getRiskFlagDetails_Array } from "@/lib/risk-detector";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/risk-flags — 거래 위험도 + 10개 신호
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const where = buildContactWhere(ctx, { id });

    const contact = await prisma.contact.findFirst({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        segment: true,
        leadScore: true,
        lastContactedAt: true,
        createdAt: true,
        departureDate: true,
        purchasedAt: true,
        adminMemo: true,
        callLogs: {
          select: { content: true, createdAt: true },
          orderBy: { createdAt: "desc" as const },
          take: 30,
        },
        memos: {
          select: { content: true, createdAt: true },
          orderBy: { createdAt: "desc" as const },
          take: 30,
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // Phase 4C: Risk Flag 감지
    const { flags, riskScore, severity } = detectRiskFlags({
      ...contact,
      callLogs: contact.callLogs || [],
      memos: contact.memos || [],
    });

    // 상세 정보
    const details = getRiskFlagDetails_Array(flags);

    return NextResponse.json({
      ok: true,
      data: {
        flags,
        riskScore,
        severity,
        details: details.map((d) => ({
          flag: d.flag,
          label: d.label,
          severity: d.severity,
          action: d.action,
        })),
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/risk-flags]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
