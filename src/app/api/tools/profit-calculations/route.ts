import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BONSA_ORG_ID } from "@/lib/rbac";

// GET /api/tools/profit-calculations — 저장 목록 조회
export async function GET() {
  const session = await getMabizSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = session;
  // GLOBAL_ADMIN(organizationId=null)은 본사 조직으로 폴백 — 저장·조회 통과
  const organizationId = session.organizationId ?? BONSA_ORG_ID;

  const items = await prisma.profitCalculation.findMany({
    where: { organizationId, userId },
    orderBy: { savedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      savedAt: true,
      salePrice: true,
      costPrice: true,
      agentMode: true,
      agentPct: true,
      agentAmt: true,
      memberMode: true,
      memberPct: true,
      memberAmt: true,
      freeAmt: true,
      freePct: true,
      overridingAmt: true,
      overridingPct: true,
      snapshotSale: true,
      snapshotNetProfit: true,
      snapshotHqProfit: true,
      exchangeRateSnapshot: true,
    },
  });

  return NextResponse.json({ items });
}

// POST /api/tools/profit-calculations — 저장
export async function POST(req: NextRequest) {
  const session = await getMabizSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = session;
  const organizationId = session.organizationId ?? BONSA_ORG_ID;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.slice(0, 100) : "계산";

  const item = await prisma.profitCalculation.create({
    data: {
      organizationId,
      userId,
      title,
      savedAt: new Date(),
      salePrice:    Number(b.salePrice)    || 0,
      costPrice:    Number(b.costPrice)    || 0,
      agentMode:    String(b.agentMode    ?? "pct"),
      agentPct:     Number(b.agentPct)    || 0,
      agentAmt:     Number(b.agentAmt)    || 0,
      memberMode:   String(b.memberMode   ?? "pct"),
      memberPct:    Number(b.memberPct)   || 0,
      memberAmt:    Number(b.memberAmt)   || 0,
      freeAmt:      Number(b.freeAmt)     || 0,
      freePct:      Number(b.freePct)     || 0,
      overridingAmt: Number(b.overridingAmt) || 0,
      overridingPct: Number(b.overridingPct) || 0,
      snapshotSale:      Number(b.snapshotSale)      || 0,
      snapshotNetProfit: Number(b.snapshotNetProfit) || 0,
      snapshotHqProfit:  Number(b.snapshotHqProfit)  || 0,
      exchangeRateSnapshot: b.exchangeRateSnapshot != null ? Number(b.exchangeRateSnapshot) : null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

// DELETE /api/tools/profit-calculations?id=xxx — 삭제
export async function DELETE(req: NextRequest) {
  const session = await getMabizSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = session;
  const organizationId = session.organizationId ?? BONSA_ORG_ID;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deleted = await prisma.profitCalculation.deleteMany({
    where: { id, organizationId, userId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
