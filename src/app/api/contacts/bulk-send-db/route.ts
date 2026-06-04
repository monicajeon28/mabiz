import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * POST /api/contacts/bulk-send-db
 * 고객 일괄 DB 전달 — N개의 contactId를 단일 요청으로 처리
 *
 * 동일 조직 내 AGENT 담당자 할당 및 타 조직으로의 복사를 서버에서 concurrency=10으로 처리한다.
 * 개별 실패 시 어떤 고객이 실패했는지 이름 목록으로 반환한다.
 *
 * 권한: 단일 send-db와 동일
 *   GLOBAL_ADMIN : 제한 없음
 *   OWNER        : 대리점장 전체 + 본사 + 자기 직속 판매원
 *   AGENT        : 본사 + 자기 대리점장(들)만
 *   FREE_SALES   : 불가
 *
 * Request:
 *   { contactIds: string[], targetUserId: string }
 *
 * Response:
 *   { ok: true, succeeded: number, failed: number, failedNames: string[] }
 *   { ok: false, message: string }
 */

const CONCURRENCY = 10;

/** p-limit 없이 순수하게 배열을 CONCURRENCY 단위로 순차 처리 */
async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(fn));
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    let body: { contactIds?: unknown; targetUserId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "JSON 파싱 오류" },
        { status: 400 }
      );
    }

    const { contactIds, targetUserId } = body;

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { ok: false, message: "전달 대상을 선택하세요." },
        { status: 400 }
      );
    }

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "전달할 고객을 선택하세요." },
        { status: 400 }
      );
    }

    if (contactIds.length > 500) {
      return NextResponse.json(
        { ok: false, message: "한 번에 500명까지 전달 가능합니다." },
        { status: 400 }
      );
    }

    const ids = contactIds as string[];

    // ── 대상 멤버/관리자 사전 조회 (요청 1회) ──────────────────────────────
    const [globalAdmin, member] = await Promise.all([
      prisma.globalAdmin.findUnique({
        where: { id: targetUserId },
        select: { id: true, displayName: true },
      }),
      prisma.organizationMember.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          displayName: true,
          organizationId: true,
          role: true,
          isActive: true,
        },
      }),
    ]);

    // ── 역할별 대상 권한 사전 검증 ─────────────────────────────────────────
    if (ctx.role === "AGENT") {
      if (!globalAdmin) {
        if (
          !member ||
          member.organizationId !== ctx.organizationId ||
          (member.role !== "OWNER" && member.role !== "BRANCH_MANAGER")
        ) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "판매원은 자기 대리점장 또는 본사로만 전달할 수 있습니다.",
            },
            { status: 403 }
          );
        }
      }
    }

    if (ctx.role === "OWNER") {
      if (!globalAdmin) {
        if (!member) {
          return NextResponse.json(
            { ok: false, message: "대상 멤버를 찾을 수 없습니다." },
            { status: 404 }
          );
        }
        const isAnyBM =
          member.role === "OWNER" || member.role === "BRANCH_MANAGER";
        const isOwnAgent =
          member.organizationId === ctx.organizationId &&
          (member.role === "AGENT" || member.role === "SALES_AGENT");
        if (!isAnyBM && !isOwnAgent) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "대리점장은 대리점장 전체, 자기 직속 판매원, 본사로만 전달할 수 있습니다.",
            },
            { status: 403 }
          );
        }
      }
    }

    if (!globalAdmin && (!member || !member.isActive)) {
      return NextResponse.json(
        { ok: false, message: "대상 멤버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // ── 타 조직일 경우 조직 이름 사전 조회 ────────────────────────────────
    let targetOrgName: string | null = null;
    if (member && member.organizationId) {
      const targetOrg = await prisma.organization.findUnique({
        where: { id: member.organizationId },
        select: { name: true },
      });
      targetOrgName = targetOrg?.name ?? null;
    }

    // ── 대상 고객 일괄 조회 (소유권 포함) ─────────────────────────────────
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: ids },
        ...(ctx.role !== "GLOBAL_ADMIN" && ctx.organizationId
          ? { organizationId: ctx.organizationId }
          : {}),
        deletedAt: null,
      },
      select: { id: true, name: true, phone: true, organizationId: true, sourceOrgId: true, email: true, type: true, cruiseInterest: true, budgetRange: true, tags: true, leadScore: true, utmSource: true, affiliateCode: true },
    });

    // 조회된 ID → Map으로 O(1) 조회
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    const failedNames: string[] = [];
    let succeeded = 0;

    await runWithConcurrency(ids, async (contactId) => {
      const contact = contactMap.get(contactId);
      if (!contact) {
        failedNames.push(`(ID: ${contactId.slice(0, 8)}…)`);
        return;
      }

      // 재공유 금지 (GLOBAL_ADMIN 제외)
      if (contact.sourceOrgId && ctx.role !== "GLOBAL_ADMIN") {
        failedNames.push(`${contact.name}(재공유불가)`);
        return;
      }

      try {
        if (globalAdmin) {
          // 본사 할당: ContactTransferLog만 생성
          await prisma.contactTransferLog.create({
            data: {
              contactId,
              fromOrgId: contact.organizationId,
              toUserId: globalAdmin.id,
              transferType: "AGENT_ASSIGN",
              transferredBy: ctx.userId,
            },
          });
          succeeded++;
          return;
        }

        if (!member) return; // 이미 위에서 검증됨

        if (member.organizationId === contact.organizationId) {
          // 같은 조직 내 할당
          const isTargetAgent =
            member.role === "AGENT" || member.role === "SALES_AGENT";
          if (isTargetAgent) {
            await prisma.$transaction([
              prisma.contact.update({
                where: { id: contactId },
                data: { assignedUserId: member.id },
              }),
              prisma.contactTransferLog.create({
                data: {
                  contactId,
                  fromOrgId: contact.organizationId,
                  toUserId: member.id,
                  transferType: "AGENT_ASSIGN",
                  transferredBy: ctx.userId,
                },
              }),
            ]);
          } else {
            await prisma.contactTransferLog.create({
              data: {
                contactId,
                fromOrgId: contact.organizationId,
                toUserId: member.id,
                transferType: "AGENT_ASSIGN",
                transferredBy: ctx.userId,
              },
            });
          }
          succeeded++;
          return;
        }

        // 타 조직 복사
        await prisma.$transaction(async (tx) => {
          const copied = await tx.contact.upsert({
            where: {
              phone_organizationId: {
                phone: contact.phone,
                organizationId: member.organizationId,
              },
            },
            create: {
              organizationId: member.organizationId,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              type: contact.type,
              cruiseInterest: contact.cruiseInterest,
              budgetRange: contact.budgetRange,
              adminMemo: `(전달 from: ${contact.organizationId})`,
              tags: contact.tags,
              leadScore: contact.leadScore,
              utmSource: contact.utmSource,
              sourceOrgId: contact.organizationId,
              affiliateCode: contact.affiliateCode,
              assignedUserId: member.id,
            },
            update: {
              adminMemo: `(재전달 from: ${contact.organizationId} on ${new Date().toLocaleDateString("ko-KR")})`,
              assignedUserId: member.id,
            },
          });

          await tx.contactTransferLog.create({
            data: {
              contactId,
              fromOrgId: contact.organizationId,
              toOrgId: member.organizationId,
              toUserId: member.id,
              newContactId: copied.id,
              transferType: "ORG_COPY",
              transferredBy: ctx.userId,
            },
          });
        });
        succeeded++;
      } catch (err) {
        logger.error("[bulk-send-db] 개별 전달 실패", {
          contactId,
          name: contact.name,
          err,
        });
        failedNames.push(contact.name);
      }
    }, CONCURRENCY);

    logger.log("[POST /api/contacts/bulk-send-db]", {
      targetUserId,
      targetOrgName,
      succeeded,
      failed: failedNames.length,
      total: ids.length,
      requestedBy: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      succeeded,
      failed: failedNames.length,
      failedNames,
    });
  } catch (err) {
    logger.error("[POST /api/contacts/bulk-send-db]", { err });
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json(
        { ok: false, message: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { ok: false, message: "일괄 전달 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
