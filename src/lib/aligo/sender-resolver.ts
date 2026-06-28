/**
 * 자동발송 SMS의 "발송자(개인 알리고 주인)" 단일 결정 규칙 (SSoT) — 2026-06-28
 *
 * 사장님 니즈: 각 판매원이 만든 퍼널/시퀀스 문자가 **자기 알리고·자기 번호**로 자동 발송.
 *
 * 우선순위: ① 퍼널/시퀀스 작성자(createdByUserId) → ② 회원 담당자(Contact.assignedUserId)
 *           → ③ undefined(=조직/env 폴백, resolveUserSmsConfig가 처리).
 *
 * 순수 함수(DB 조회 없음) — 이미 로드된 후보값에서 우선순위만 적용. N+1 원천 차단.
 * 사용: const uid = resolveSenderUserId({...}); const cfg = await resolveUserSmsConfig(orgId, uid);
 *   - resolveUserSmsConfig 내부가 senderVerified=false·복호화 실패 시 조직>env로 자동 폴백 →
 *     userId를 넘겨도 발송이 끊기지 않는다(개인 미설정 판매원도 안전).
 *   - undefined 반환 = "조직 발송" 의도. 호출부는 senderVerified를 직접 검사하지 말 것.
 */
export interface SenderCandidate {
  /** ① 퍼널/시퀀스/예약문자 작성자(createdByUserId) — 가장 우선(만든 사람 것) */
  funnelCreatorUserId?: string | null;
  /** ② 회원 담당자(Contact.assignedUserId) */
  contactAssignedUserId?: string | null;
}

export function resolveSenderUserId(c: SenderCandidate): string | undefined {
  return c.funnelCreatorUserId || c.contactAssignedUserId || undefined;
}
