/**
 * 크루즈닷봇 핫리드 핸드오프 알림 (작업지시서 Phase 4)
 *
 * 봇이 구매 임박 손님(HANDOFF)을 감지하면 **귀속 판매원에게 즉시 SMS**로 알린다.
 * - 발신: 조직/시스템 Aligo(resolveUserSmsConfig org), 수신: OrganizationMember.phone
 * - 중복 알림 방지: 호출측이 status 전이(ACTIVE→HANDED_OFF 1회)에서만 호출하도록 보장
 * - Vercel 서버리스에서 응답 후 비동기 완료 미보장 → 호출측은 응답 전에 await 할 것
 * - 카톡 알림톡은 템플릿 승인 필요 → 우선 SMS, 추후 sendKakaoAlimtalk 확장
 */
import "server-only";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { resolveUserSmsConfig, sendSms } from "@/lib/aligo";

const SALES_ROLES = ["OWNER", "AGENT", "FREE_SALES"];

export async function notifyAgentHotLead(input: {
  conversationId: string;
  organizationId: string;
  attributedAgentId: string | null;
  intentScore: number;
  customerPhone?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const { conversationId, organizationId, attributedAgentId, intentScore, customerPhone } = input;

  // 무귀속 핫리드는 가시화만(누구에게 알릴지 없음)
  if (!attributedAgentId) {
    logger.log("[bot-handoff] 무귀속 핫리드 — 알림 대상 없음", { conversationId });
    return { sent: false, reason: "no_agent" };
  }

  // 판매원 조회(동일 org·활성·판매역할) → 전화번호
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId: attributedAgentId,
      organizationId,
      isActive: true,
      role: { in: SALES_ROLES },
    },
    select: { phone: true, displayName: true },
  });
  if (!member?.phone) {
    logger.log("[bot-handoff] 판매원 전화 없음 — 알림 스킵", { conversationId, attributedAgentId });
    return { sent: false, reason: "no_phone" };
  }

  // 발신은 조직/시스템 Aligo (판매원에게 보내는 알림)
  const config = await resolveUserSmsConfig(organizationId);
  if (!config) {
    logger.warn("[bot-handoff] SMS 설정 없음 — 알림 스킵", { organizationId });
    return { sent: false, reason: "no_sms_config" };
  }

  const name = member.displayName ? `${member.displayName}님, ` : "";
  const phoneLine = customerPhone ? `\n손님 연락처: ${customerPhone}` : "";
  const msg = `[크루즈닷봇] ${name}구매에 관심을 보이는 손님이 지금 상담 중이에요. (구매의사 ${intentScore}점) 빠르게 연락해 주세요.${phoneLine}`;

  try {
    const res = await sendSms({
      config,
      receiver: member.phone,
      msg,
      title: "크루즈닷봇 핫리드",
      organizationId,
      channel: "MANUAL",
    });
    const ok = (res.result_code ?? -1) > 0; // Aligo: 양수=성공, 음수=실패
    logger.log("[bot-handoff] 핫리드 알림", {
      conversationId,
      ok,
      code: res.result_code,
    });
    return { sent: ok, reason: ok ? undefined : "send_failed" };
  } catch (err) {
    logger.error("[bot-handoff] 알림 발송 오류", {
      conversationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: "error" };
  }
}
