import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { extractCsrfToken, validateToken } from "@/lib/csrf";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contacts/[id]/send-db
 * DB 전달 — targetUserId 하나로 처리
 *
 * targetUserId = OrganizationMember.id  OR  GlobalAdmin.id
 *
 * 권한:
 *   GLOBAL_ADMIN : 제한 없음 (누구든 전달 가능)
 *   OWNER        : 지사장 전체 + 본사 + 자기 직속 대리점장
 *   AGENT        : 본사 + 자기 지사장(들)만
 *   FREE_SALES   : 불가
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();

    // [S-002] CSRF 토큰 검증 (세션 기반) — Redis 우선, 폴백 메모리
    const csrfToken = extractCsrfToken(req);
    if (!csrfToken || !(await validateToken(ctx.userId, csrfToken))) {
      return NextResponse.json(
        { ok: false, message: "보안 검증 실패: CSRF 토큰이 유효하지 않습니다" },
        { status: 403 }
      );
    }

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { id: contactId } = await params;
    const { targetUserId } = (await req.json()) as { targetUserId?: string };

    if (!targetUserId) {
      return NextResponse.json(
        { ok: false, message: "전달 대상을 선택하세요." },
        { status: 400 }
      );
    }

    // ── 고객 조회 (소유권 검증) ──────────────────────────────
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        ...(ctx.role !== "GLOBAL_ADMIN" && ctx.organizationId
          ? { organizationId: ctx.organizationId }
          : {}),
      },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, message: "고객을 찾을 수 없습니다." }, { status: 404 });
    }

    // ── 재공유 금지: 공유받은 복사본(sourceOrgId 있음)은 원작자 조직 외 전달 불가 ──
    // GLOBAL_ADMIN은 예외 (최상위 권한)
    if (contact.sourceOrgId && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "공유받은 DB는 재공유할 수 없습니다. 원작자 조직에서만 전달 가능합니다." },
        { status: 403 }
      );
    }

    // ── 대상 조회: GlobalAdmin + OrganizationMember 병렬 조회 ──
    const [globalAdmin, member] = await Promise.all([
      prisma.globalAdmin.findUnique({
        where:  { id: targetUserId },
        select: { id: true, displayName: true },
      }),
      prisma.organizationMember.findUnique({
        where:  { id: targetUserId },
        select: { id: true, displayName: true, organizationId: true, role: true, isActive: true },
      }),
    ]);

    // ── 역할별 권한 검증 ─────────────────────────────────────
    if (ctx.role === "AGENT") {
      // 대리점장: 본사 또는 자기 지사장만 허용
      if (!globalAdmin) {
        // OrganizationMember 대상인 경우 — 자기 조직의 BRANCH_MANAGER/OWNER만 허용
        if (
          !member ||
          member.organizationId !== ctx.organizationId ||
          (member.role !== "OWNER" && member.role !== "BRANCH_MANAGER")
        ) {
          return NextResponse.json(
            { ok: false, message: "대리점장은 자기 지사장 또는 본사로만 전달할 수 있습니다." },
            { status: 403 }
          );
        }
      }
    }

    if (ctx.role === "OWNER") {
      // 지사장: 본사, 모든 지사장, 자기 직속 대리점장만 허용
      if (!globalAdmin) {
        if (!member) {
          return NextResponse.json(
            { ok: false, message: "대상 멤버를 찾을 수 없습니다." },
            { status: 404 }
          );
        }
        const isAnyBM = member.role === "OWNER" || member.role === "BRANCH_MANAGER";
        const isOwnAgent =
          member.organizationId === ctx.organizationId &&
          (member.role === "AGENT" || member.role === "SALES_AGENT");

        if (!isAnyBM && !isOwnAgent) {
          return NextResponse.json(
            { ok: false, message: "지사장은 지사장 전체, 자기 직속 대리점장, 본사로만 전달할 수 있습니다." },
            { status: 403 }
          );
        }
      }
    }

    // ── 대상이 GlobalAdmin → 본사 전달 ──────────────────────
    if (globalAdmin) {
      // GlobalAdmin은 모든 고객을 열람 가능 → assignedUserId 변경 불필요
      // 원본 연락처는 현재 담당자(sender)에게 유지
      await prisma.contactTransferLog.create({
        data: {
          contactId:     contactId,
          fromOrgId:     contact.organizationId,
          toUserId:      globalAdmin.id,
          transferType:  "AGENT_ASSIGN",
          transferredBy: ctx.userId,
        },
      });

      logger.log("[send-db] 본사 할당", { contactId, targetUserId, name: globalAdmin.displayName });
      return NextResponse.json({ ok: true, agentName: globalAdmin.displayName ?? "본사" });
    }

    if (!member || !member.isActive) {
      return NextResponse.json(
        { ok: false, message: "대상 멤버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // ── 같은 조직 → 담당자 할당 ───────────────────────────
    if (member.organizationId === contact.organizationId) {
      const isTargetAgent = member.role === "AGENT" || member.role === "SALES_AGENT";
      // AGENT/SALES_AGENT 대상: assignedUserId 업데이트 필요 (필터 기반 조회)
      // OWNER/BRANCH_MANAGER 대상: 조직 전체 열람 가능 → 원본은 sender에 유지
      if (isTargetAgent) {
        await prisma.$transaction([
          prisma.contact.update({ where: { id: contactId, organizationId: contact.organizationId }, data: { assignedUserId: member.id } }),
          prisma.contactTransferLog.create({
            data: { contactId, fromOrgId: contact.organizationId, toUserId: member.id, transferType: "AGENT_ASSIGN", transferredBy: ctx.userId },
          }),
        ]);
      } else {
        await prisma.contactTransferLog.create({
          data: { contactId, fromOrgId: contact.organizationId, toUserId: member.id, transferType: "AGENT_ASSIGN", transferredBy: ctx.userId },
        });
      }

      logger.log("[send-db] 같은 조직 할당", { contactId, targetUserId, name: member.displayName });
      return NextResponse.json({ ok: true, agentName: member.displayName ?? targetUserId });
    }

    // ── 다른 조직 → 고객 복사 + 할당 ────────────────────────
    const targetOrg = await prisma.organization.findUnique({
      where:  { id: member.organizationId },
      select: { name: true },
    });

    const [transferred] = await prisma.$transaction(async (tx) => {
      const copied = await tx.contact.upsert({
        where: {
          phone_organizationId: {
            phone:          contact.phone,
            organizationId: member.organizationId,
          },
        },
        create: {
          organizationId:  member.organizationId,
          name:            contact.name,
          phone:           contact.phone,
          email:           contact.email,
          type:            contact.type,
          cruiseInterest:  contact.cruiseInterest,
          budgetRange:     contact.budgetRange,
          adminMemo:       `(전달 from: ${contact.organizationId})`,
          tags:            contact.tags,
          leadScore:       contact.leadScore,
          utmSource:       contact.utmSource,
          sourceOrgId:     contact.organizationId,
          affiliateCode:   contact.affiliateCode,
          assignedUserId:  member.id,
        },
        update: {
          adminMemo:      `(재전달 from: ${contact.organizationId} on ${new Date().toLocaleDateString("ko-KR")})`,
          assignedUserId: member.id,
        },
      });

      const log = await tx.contactTransferLog.create({
        data: {
          contactId:     contactId,
          fromOrgId:     contact.organizationId,
          toOrgId:       member.organizationId,
          toUserId:      member.id,
          newContactId:  copied.id,
          transferType:  "ORG_COPY",
          transferredBy: ctx.userId,
        },
      });

      return [copied, log] as const;
    });

    logger.log("[send-db] 조직 간 전달", {
      contactId, from: contact.organizationId,
      to: member.organizationId, name: member.displayName,
    });

    return NextResponse.json({
      ok:        true,
      agentName: `${member.displayName ?? targetUserId} (${targetOrg?.name ?? member.organizationId})`,
      contactId: transferred.id,
    });

  } catch (err) {
    logger.error("[POST /api/contacts/[id]/send-db]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
