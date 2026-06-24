import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { buildFunnelSmsWhere, findAccessibleFunnelSms } from "@/lib/funnel-sms-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/funnel-sms/sent-history
 *
 * 사람별 퍼널문자 발송내역 조회 API (SSoT = ScheduledSms).
 * "누가 언제 그룹에 들어와서(addedAt) 몇 회차(round) 나갔는지" 추적.
 *
 * 쿼리 파라미터:
 *  - funnelSmsId?  : 특정 퍼널문자 단위 집계 (없으면 channel startsWith 'FUNNEL_SMS:' 전체)
 *  - groupId?      : 특정 그룹 한정
 *  - round?        : 특정 회차(0=1일차, 1=2일차 ...) 한정
 *  - status?       : SENT/FAILED/BLOCKED/PENDING/SENDING 등 상태 한정
 *  - days          : 조회 기간(scheduledAt 기준), 기본 30 · 최대 90
 *  - page          : 페이지(1-base), 기본 1
 *  - take          : 페이지당 행 수, 기본 50 · 최대 100
 *
 * 보안: getAuthContext/resolveOrgId 로 orgId 확정 → organizationId 필터로 IDOR 방지.
 * 절대 SmsLog 사용 금지 (ScheduledSms 가 회차/타이밍 SSoT).
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const { searchParams } = new URL(req.url);

    const funnelSmsId = searchParams.get("funnelSmsId")?.trim() || undefined;
    const groupId = searchParams.get("groupId")?.trim() || undefined;

    const roundParam = searchParams.get("round");
    const round =
      roundParam !== null && roundParam.trim() !== "" && Number.isFinite(Number(roundParam))
        ? Number(roundParam)
        : undefined;

    const status = searchParams.get("status")?.trim() || undefined;

    const days = Math.min(Math.max(Number(searchParams.get("days") ?? "30") || 30, 1), 90);
    const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
    const take = Math.min(Math.max(Number(searchParams.get("take") ?? "50") || 50, 1), 100);
    const skip = (page - 1) * take;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // per-user 격리: AGENT는 본인 소유/공유/조직공용 퍼널의 발송내역만 조회 가능.
    // - funnelSmsId 지정 시: 해당 퍼널 접근 권한 확인 (없으면 403).
    // - 미지정(전체 집계) 시: AGENT는 접근 가능한 퍼널 id 집합으로 한정.
    const isAgentScoped = ctx.role !== "GLOBAL_ADMIN" && ctx.role !== "OWNER";

    if (funnelSmsId) {
      const accessible = await findAccessibleFunnelSms(ctx, funnelSmsId);
      if (!accessible) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN", message: "조회 권한이 없는 퍼널문자입니다." },
          { status: 403 }
        );
      }
    }

    // where 구성: 퍼널문자 단위 집계
    // - funnelSmsId 지정 시: funnelSmsId 컬럼 일치 (스냅샷 컬럼 우선)
    // - 미지정 시: channel startsWith 'FUNNEL_SMS:' (레거시 + 신규 모두 포괄)
    const where: Record<string, unknown> = {
      organizationId: orgId,
      scheduledAt: { gte: since },
    };
    if (funnelSmsId) {
      where.funnelSmsId = funnelSmsId;
    } else {
      where.channel = { startsWith: "FUNNEL_SMS:" };

      // AGENT 전체 집계: 접근 가능한 퍼널 id로 제한 (타인 퍼널 발송내역 차단).
      // 레거시 행(funnelSmsId 스냅샷 null)은 채널만으로 매칭되므로 funnelSmsId IN 으로
      // 한정하면 함께 제외됨 → 본인 권한 범위 밖 데이터 노출 방지(보수적 격리).
      if (isAgentScoped) {
        const accessibleFunnels = await prisma.funnelSms.findMany({
          where: buildFunnelSmsWhere(ctx) as never,
          select: { id: true },
        });
        where.funnelSmsId = { in: accessibleFunnels.map((f) => f.id) };
      }
    }
    if (groupId) where.groupId = groupId;
    if (round !== undefined) where.round = round;
    if (status) {
      // 'BLOCKED' 요청 시 야간 차단(NIGHT_BLOCKED) 등 BLOCKED 계열 변형을 모두 포함
      where.status = status === "BLOCKED" ? { in: ["BLOCKED", "NIGHT_BLOCKED"] } : status;
    }

    const [rowsRaw, total, statusGroups] = await Promise.all([
      prisma.scheduledSms.findMany({
        where,
        orderBy: [{ contactId: "asc" }, { round: "asc" }],
        skip,
        take,
        select: {
          id: true,
          contactId: true,
          groupId: true,
          scheduledAt: true,
          sentAt: true,
          status: true,
          channel: true,
          round: true,
          funnelSmsMessageId: true,
        },
      }),
      prisma.scheduledSms.count({ where }),
      prisma.scheduledSms.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
    ]);

    // ─── Contact 배치 조회 (N+1 금지) ───
    const contactIds = Array.from(
      new Set(rowsRaw.map((r) => r.contactId).filter((v): v is string => Boolean(v)))
    );
    const contacts = contactIds.length
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds }, organizationId: orgId },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    // ─── ContactGroupMember(addedAt) 배치 조회 (N+1 금지) ───
    // (contactId, groupId) 쌍별 addedAt 매핑. groupId 없는 행은 제외.
    const memberGroupIds = Array.from(
      new Set(rowsRaw.map((r) => r.groupId).filter((v): v is string => Boolean(v)))
    );
    const members =
      contactIds.length && memberGroupIds.length
        ? await prisma.contactGroupMember.findMany({
            where: {
              contactId: { in: contactIds },
              groupId: { in: memberGroupIds },
            },
            select: { contactId: true, groupId: true, addedAt: true },
          })
        : [];
    const addedAtMap = new Map(members.map((m) => [`${m.contactId}::${m.groupId}`, m.addedAt]));

    // ─── round NULL 폴백: channel 3번째 토큰 → FunnelSmsMessage.daysAfter 역조인 ───
    // (best-effort; 과거(레거시) 행은 round 스냅샷이 없을 수 있음)
    const fallbackMsgIds = Array.from(
      new Set(
        rowsRaw
          .filter((r) => r.round === null || r.round === undefined)
          .map((r) => r.funnelSmsMessageId || r.channel?.split(":")[2])
          .filter((v): v is string => Boolean(v))
      )
    );
    let daysAfterMap = new Map<string, number>();
    if (fallbackMsgIds.length) {
      try {
        const msgs = await prisma.funnelSmsMessage.findMany({
          where: { id: { in: fallbackMsgIds } },
          select: { id: true, daysAfter: true },
        });
        daysAfterMap = new Map(msgs.map((m) => [m.id, m.daysAfter]));
      } catch (e) {
        // best-effort 폴백: 실패해도 round=null 로 응답 (치명적 아님)
        logger.error("[GET /api/funnel-sms/sent-history] round fallback failed", { err: e });
      }
    }

    const rows = rowsRaw.map((r) => {
      const c = r.contactId ? contactMap.get(r.contactId) : undefined;

      // 회차 결정: 스냅샷 round 우선, 없으면 message.daysAfter 폴백
      let resolvedRound: number | null = r.round ?? null;
      if (resolvedRound === null) {
        const msgKey = r.funnelSmsMessageId || r.channel?.split(":")[2];
        if (msgKey && daysAfterMap.has(msgKey)) {
          resolvedRound = daysAfterMap.get(msgKey) ?? null;
        }
      }

      const addedAt =
        r.contactId && r.groupId
          ? addedAtMap.get(`${r.contactId}::${r.groupId}`) ?? null
          : null;

      return {
        contactId: r.contactId,
        name: c?.name ?? null,
        phone: c?.phone ?? null,
        addedAt,
        round: resolvedRound,
        dayLabel: resolvedRound, // = daysAfter = N일차 (0-인덱스: round 0 → 0일차=유입 당일)
        status: r.status,
        scheduledAt: r.scheduledAt,
        sentAt: r.sentAt,
        groupId: r.groupId,
      };
    });

    // ─── summary: status 버킷 집계 ───
    // 형제 stats route(s.includes('BLOCKED'))와 동일한 포함 매칭 사용
    // → NIGHT_BLOCKED 및 향후 BLOCKED_* 변형까지 blocked 버킷에 합산.
    const summary = { total, sent: 0, failed: 0, blocked: 0, pending: 0 };
    for (const g of statusGroups) {
      const count = g._count._all;
      const s = g.status ?? "";
      if (s === "SENT") {
        summary.sent += count;
      } else if (s === "FAILED") {
        summary.failed += count;
      } else if (s.includes("BLOCKED")) {
        summary.blocked += count;
      } else if (s === "PENDING" || s === "SENDING") {
        summary.pending += count;
      }
    }

    logger.log("[GET /api/funnel-sms/sent-history]", {
      orgId,
      funnelSmsId,
      groupId,
      round,
      status,
      days,
      page,
      take,
      total,
    });

    return NextResponse.json({
      ok: true,
      rows,
      summary,
      total,
      page,
    });
  } catch (err) {
    logger.error("[GET /api/funnel-sms/sent-history]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
