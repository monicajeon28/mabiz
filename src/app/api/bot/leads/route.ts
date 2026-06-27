/**
 * GET /api/bot/leads — 대리점장 봇 대시보드용 내 핫리드 목록 (작업지시서 Phase 6)
 *
 * per-user 격리: AGENT/FREE_SALES 는 본인 귀속(attributedAgentId)만, OWNER/GLOBAL_ADMIN 은 조직 전체.
 * 손님 발화는 저장 시점에 이미 마스킹됨 + 전화는 추가 마스킹해서 노출.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/pii-masker";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getAuthContext();
    const orgId =
      ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId ? BONSA_ORG_ID : resolveOrgId(ctx);

    const where = {
      organizationId: orgId,
      ...(ctx.role === "AGENT" || ctx.role === "FREE_SALES"
        ? { attributedAgentId: ctx.userId }
        : {}),
    };

    const convos = await prisma.botConversation.findMany({
      where,
      orderBy: [{ intentScore: "desc" }, { lastMessageAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        fsmState: true,
        intentScore: true,
        closeAttempts: true,
        attributionSource: true,
        source: true, // chat | button_gate
        qualifiers: true, // {when,who} — 버튼 플로우 자격검증(공략 설계도)
        objectionTags: true, // 누적 반론 태그
        customerPhone: true,
        customerName: true,
        lastMessageAt: true,
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    });

    const leads = convos.map((c) => ({
      id: c.id,
      status: c.status,
      fsmState: c.fsmState,
      intentScore: c.intentScore,
      closeAttempts: c.closeAttempts,
      attributionSource: c.attributionSource,
      source: c.source, // 출처(상담봇 채팅 vs 버튼 신청)
      // 핫DB 공략 설계도 — 희망(시기·동행) + 관심·걱정(반론). 판매원 콜 준비용.
      qualifiers: (c.qualifiers as { when?: string; who?: string } | null) ?? null,
      objectionTags: Array.isArray(c.objectionTags) ? (c.objectionTags as string[]) : [],
      hasPhone: !!c.customerPhone,
      customerPhoneMasked: c.customerPhone ? maskPhone(c.customerPhone) : null,
      customerName: c.customerName,
      lastUserMessage: c.messages[0]?.content ?? null, // 저장 시점에 마스킹됨
      lastMessageAt: c.lastMessageAt,
    }));

    return NextResponse.json({ ok: true, leads });
  } catch (err) {
    logger.error("[GET /api/bot/leads]", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, message: "불러오기에 실패했어요." }, { status: 500 });
  }
}
