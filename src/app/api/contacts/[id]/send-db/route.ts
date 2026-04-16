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

      // 트랜잭션: 복사 + 이력 동시 저장
      const [transferred] = await prisma.$transaction(async (tx) => {
        const copied = await tx.contact.upsert({
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
            sourceOrgId:     contact.organizationId,
            affiliateCode:   contact.affiliateCode,
          },
          update: {
            adminMemo: `(재전달 from: ${contact.organizationId} on ${new Date().toLocaleDateString("ko-KR")})`,
          },
        });

        // 전달 이력 기록
        const log = await tx.contactTransferLog.create({
          data: {
            contactId:     contactId,
            fromOrgId:     contact.organizationId,
            toOrgId:       targetOrgId,
            newContactId:  copied.id,
            transferType:  "ORG_COPY",
            transferredBy: ctx.userId,
          },
        });

        return [copied, log] as const;
      });

      logger.log("[POST /api/contacts/[id]/send-db] 조직 간 전달 완료", {
        contactId, fromOrg: contact.organizationId,
        targetOrgId, targetOrgName: targetOrg.name,
        newContactId: transferred.id,
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

      // 트랜잭션: 할당 + 이력 동시 저장
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contactId },
          data:  { assignedUserId: targetUserId },
        }),
        prisma.contactTransferLog.create({
          data: {
            contactId:     contactId,
            fromOrgId:     contact.organizationId,
            toUserId:      targetUserId,
            transferType:  "AGENT_ASSIGN",
            transferredBy: ctx.userId,
          },
        }),
      ]);

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
