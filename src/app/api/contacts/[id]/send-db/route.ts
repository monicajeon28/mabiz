import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contacts/[id]/send-db
 * DB 전달 — 두 가지 모드:
 *   1. targetOrgId  → 다른 대리점 조직으로 고객 복사 (대리점 교환)
 *   2. targetUserId → 자기 조직 AGENT에게 할당 (담당자 지정)
 *
 * 권한:
 *   GLOBAL_ADMIN: 모든 조직 → 어디든 전달
 *   OWNER: 자기 조직 고객 → 다른 조직 또는 자기 팀 AGENT
 *   AGENT: 불가
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "AGENT") {
      return NextResponse.json({ ok: false, message: "판매원은 DB 전달 권한이 없습니다." }, { status: 403 });
    }

    const { id: contactId } = await params;
    const body = await req.json() as {
      targetOrgId?:  string;  // 다른 조직으로 복사
      targetUserId?: string;  // 같은 조직 내 AGENT 할당
    };

    const { targetOrgId, targetUserId } = body;

    if (!targetOrgId && !targetUserId) {
      return NextResponse.json({ ok: false, message: "전달 대상을 선택하세요." }, { status: 400 });
    }

    // 소유권 검증
    const orgId = ctx.role === "GLOBAL_ADMIN"
      ? undefined
      : requireOrgId(ctx);

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // ── 모드 1: 다른 조직으로 복사 ─────────────────────────
    if (targetOrgId) {
      // 대상 조직 존재 여부 확인
      const targetOrg = await prisma.organization.findUnique({
        where: { id: targetOrgId },
        select: { id: true, name: true },
      });
      if (!targetOrg) {
        return NextResponse.json({ ok: false, message: "대상 조직을 찾을 수 없습니다." }, { status: 404 });
      }

      // 중복 확인 후 upsert (전화번호 + 조직 unique)
      const transferred = await prisma.contact.upsert({
        where: {
          phone_organizationId: {
            phone:          contact.phone,
            organizationId: targetOrgId,
          },
        },
        create: {
          organizationId:  targetOrgId,
          name:            contact.name,
          phone:           contact.phone,
          email:           contact.email,
          type:            contact.type,
          cruiseInterest:  contact.cruiseInterest,
          budgetRange:     contact.budgetRange,
          adminMemo:       contact.adminMemo
            ? `[${contact.adminMemo}] (전달 from: ${contact.organizationId})`
            : `(전달 from: ${contact.organizationId})`,
          tags:            contact.tags,
          leadScore:       contact.leadScore,
          utmSource:       contact.utmSource,
          sourceOrgId:     contact.organizationId,  // 원본 조직 기록
          freeSalesId:     contact.freeSalesId,
        },
        update: {
          // 이미 있으면 메모만 업데이트
          adminMemo: `(재전달 from: ${contact.organizationId} on ${new Date().toLocaleDateString("ko-KR")})`,
        },
      });

      logger.log("[POST /api/contacts/[id]/send-db] 조직 간 전달", {
        contactId, fromOrg: contact.organizationId,
        targetOrgId, targetOrgName: targetOrg.name,
      });

      return NextResponse.json({
        ok: true,
        mode: "org-transfer",
        targetOrgName: targetOrg.name,
        contactId: transferred.id,
      });
    }

    // ── 모드 2: 같은 조직 내 AGENT 할당 ─────────────────────
    if (targetUserId) {
      // AGENT가 같은 조직 소속인지 검증
      const agentMember = await prisma.organizationMember.findFirst({
        where: {
          userId:         targetUserId,
          organizationId: contact.organizationId,
          role:           "AGENT",
          isActive:       true,
        },
        select: { displayName: true },
      });

      if (!agentMember) {
        return NextResponse.json(
          { ok: false, message: "해당 판매원이 같은 조직 소속이 아닙니다." },
          { status: 400 }
        );
      }

      await prisma.contact.update({
        where: { id: contactId },
        data:  { assignedUserId: targetUserId },
      });

      logger.log("[POST /api/contacts/[id]/send-db] AGENT 할당", {
        contactId,
        targetUserId,
        agentName: agentMember.displayName,
      });

      return NextResponse.json({
        ok: true,
        mode: "agent-assign",
        agentName: agentMember.displayName,
      });
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/send-db]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
