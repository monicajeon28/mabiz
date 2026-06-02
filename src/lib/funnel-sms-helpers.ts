/**
 * 퍼널문자(FunnelSms) 발신번호 검증 헬퍼
 *
 * 배경 (P0 보안):
 *   FunnelSms.senderPhone은 사용자가 자유롭게 입력 가능하므로,
 *   검증 없이 Aligo 발송에 사용하면 타 조직/공공기관 번호로 발송될 수 있음.
 *   발신번호 변작은 「전기통신사업법」 위반(형사 사건)이므로,
 *   조직이 등록·검증(senderVerified)한 번호와 일치할 때만 사용한다.
 *
 * 정책:
 *   - senderPhone 미설정 → org 기본 발신번호(OrgSmsConfig.senderPhone) 폴백 (valid)
 *   - senderPhone 설정 + org 검증번호와 일치 → 사용 (valid)
 *   - senderPhone 설정 + 불일치/미검증 → 거부, org 기본번호로 폴백 (invalid)
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface SenderPhoneValidation {
  /** senderPhone을 그대로 사용할 수 있는지 여부 */
  valid: boolean;
  /** 실제 발송에 사용할 번호 (검증 통과 시 senderPhone, 실패 시 org 기본번호) */
  fallbackPhone?: string;
}

/**
 * 전화번호 정규화 — 비교 시 하이픈/공백 차이로 인한 오탐 방지
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * FunnelSms.senderPhone이 조직의 등록·검증된 발신번호인지 확인한다.
 *
 * @param organizationId 조직 ID (테넌트 격리)
 * @param senderPhone    검증할 발신번호 (FunnelSms.senderPhone 등)
 */
export async function validateSenderPhone(
  organizationId: string,
  senderPhone: string | null | undefined
): Promise<SenderPhoneValidation> {
  const orgSmsConfig = await prisma.orgSmsConfig.findUnique({
    where: { organizationId },
    select: { senderPhone: true, senderVerified: true },
  });

  const orgPhone = orgSmsConfig?.senderPhone?.trim() || undefined;

  // 발신번호 미설정 → org 기본번호 폴백 (정상)
  const trimmed = senderPhone?.trim();
  if (!trimmed) {
    return { valid: true, fallbackPhone: orgPhone };
  }

  // org가 검증한 발신번호와 일치하는지 확인
  const isValid =
    !!orgSmsConfig?.senderVerified &&
    !!orgPhone &&
    normalizePhone(trimmed) === normalizePhone(orgPhone);

  if (!isValid) {
    logger.warn('[validateSenderPhone] 미등록/미검증 발신번호 거부', {
      organizationId,
      attempted: trimmed,
      registered: orgPhone,
      senderVerified: orgSmsConfig?.senderVerified ?? false,
    });
    return { valid: false, fallbackPhone: orgPhone };
  }

  return { valid: true, fallbackPhone: trimmed };
}
