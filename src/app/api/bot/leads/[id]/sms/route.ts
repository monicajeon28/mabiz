/**
 * POST /api/bot/leads/[id]/sms — 판매원이 봇 리드 손님에게 "한 번 더 클로징 문자" 발송 (Phase 6)
 *
 * per-user 격리: AGENT/FREE_SALES 는 본인 귀속 리드만. 발신은 판매원 본인 Aligo(개인>조직>env).
 * 손님 연락처(customerPhone)가 저장돼 있어야 발송 가능.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { checkOrigin } from "@/lib/origin-guard";
import { resolveUserSmsConfig, sendSms } from "@/lib/aligo";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, "BotLeadSms")) {
      return NextResponse.json({ ok: false, message: "잘못된 접근입니다." }, { status: 403 });
    }
    const ctx = await getAuthContext();
    const orgId =
      ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId ? BONSA_ORG_ID : resolveOrgId(ctx);
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const message = String(body?.message ?? "").trim().slice(0, 1000);
    if (!message) {
      return NextResponse.json({ ok: false, message: "보낼 내용을 입력해주세요." }, { status: 400 });
    }

    const convo = await prisma.botConversation.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, attributedAgentId: true, customerPhone: true },
    });
    if (!convo) {
      return NextResponse.json({ ok: false, message: "대화를 찾을 수 없습니다." }, { status: 404 });
    }
    // per-user 격리: 판매원은 본인 귀속 리드만
    if (
      (ctx.role === "AGENT" || ctx.role === "FREE_SALES") &&
      convo.attributedAgentId !== ctx.userId
    ) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }
    if (!convo.customerPhone) {
      return NextResponse.json(
        { ok: false, message: "이 손님은 아직 연락처를 남기지 않았어요." },
        { status: 400 },
      );
    }

    const config = await resolveUserSmsConfig(orgId, ctx.userId); // 판매원 본인 발신
    if (!config) {
      return NextResponse.json(
        { ok: false, message: "문자 발신 설정이 없어요. 설정 > 문자에서 발신번호를 등록해주세요." },
        { status: 400 },
      );
    }

    const res = await sendSms({
      config,
      receiver: convo.customerPhone,
      msg: message,
      organizationId: orgId,
      channel: "MANUAL",
    });
    const ok = (res.result_code ?? -1) > 0;
    logger.log("[POST /api/bot/leads/[id]/sms]", { convoId: id, ok, code: res.result_code });
    return NextResponse.json(
      { ok, message: ok ? "문자를 보냈어요." : "문자 발송에 실패했어요." },
      { status: ok ? 200 : 502 },
    );
  } catch (err) {
    logger.error("[POST /api/bot/leads/[id]/sms]", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, message: "발송에 실패했어요." }, { status: 500 });
  }
}
