/**
 * 리드 스코어링 유틸 (WO-25B)
 *
 * HOT  (70+): 지금 바로 전화해야 할 사람
 * WARM (30~69): 퍼널 유지하며 지켜볼 사람
 * COLD (0~29): 재활성화 캠페인 필요
 * LOST (음수): 수신거부 또는 완전 거절
 */

import prisma from "@/lib/prisma";

// ─── 이벤트별 점수 ────────────────────────────────────────────
export const SCORE = {
  LANDING_REGISTER:   30,   // 랜딩 등록 = 강력한 관심 신호
  CALL_INTERESTED:    25,   // 콜 결과: 관심있음
  CALL_RESCHEDULED:   15,   // 콜 결과: 재콜 수락
  CALL_PENDING:        5,   // 콜 결과: 보류 (중립)
  CALL_REJECTED:     -20,   // 콜 결과: 거절
  GROUP_ASSIGNED:     10,   // 그룹 배정
  SMS_MANUAL:          5,   // 수동 SMS 발송 (파트너 관심)
  PURCHASED:         100,   // 구매 완료
  OPT_OUT:          -100,   // 수신거부
  STALE_14D:          -5,   // 14일 무응답 (cron, 최대 3회)
} as const;

export type ScoreEvent = keyof typeof SCORE;

// ─── 티어 계산 ────────────────────────────────────────────────
export function getLeadTier(score: number): "HOT" | "WARM" | "COLD" | "LOST" {
  if (score >= 70)  return "HOT";
  if (score >= 30)  return "WARM";
  if (score >= 0)   return "COLD";
  return "LOST";
}

export const TIER_UI = {
  HOT:  { label: "🔥 HOT",  color: "bg-red-100 text-red-700",    border: "border-red-200" },
  WARM: { label: "☀️ WARM", color: "bg-orange-100 text-orange-600", border: "border-orange-200" },
  COLD: { label: "❄️ COLD", color: "bg-blue-100 text-blue-600",   border: "border-blue-200" },
  LOST: { label: "💤 LOST", color: "bg-gray-100 text-gray-400",   border: "border-gray-200" },
} as const;

// ─── 점수 업데이트 (fire-and-forget 안전) ────────────────────
export async function addLeadScore(
  contactId: string,
  event: ScoreEvent,
): Promise<void> {
  const delta = SCORE[event] as number;
  if (!delta) return;

  try {
    await prisma.contact.update({
      where: { id: contactId },
      data:  { leadScore: { increment: delta } },
    });
  } catch {
    // 점수 업데이트 실패는 메인 로직을 막지 않음
  }
}
