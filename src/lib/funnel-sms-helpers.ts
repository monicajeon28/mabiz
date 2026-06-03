/**
 * 퍼널문자(FunnelSms) 헬퍼 모음
 *
 * [1] 발신번호 검증 (validateSenderPhone)
 *   FunnelSms.senderPhone은 사용자가 자유롭게 입력 가능하므로,
 *   검증 없이 Aligo 발송에 사용하면 타 조직/공공기관 번호로 발송될 수 있음.
 *   발신번호 변작은 「전기통신사업법」 위반(형사 사건)이므로,
 *   조직이 등록·검증(senderVerified)한 번호와 일치할 때만 사용한다.
 *
 *   정책:
 *   - senderPhone 미설정 → org 기본 발신번호(OrgSmsConfig.senderPhone) 폴백 (valid)
 *   - senderPhone 설정 + org 검증번호와 일치 → 사용 (valid)
 *   - senderPhone 설정 + 불일치/미검증 → 거부, org 기본번호로 폴백 (invalid)
 *
 * [2] 퍼널문자 멱등성 체크 (checkFunnelSmsIdempotency)
 *   동일 contact + funnelSms 조합에 대해 PENDING/SENT/SENDING 상태의
 *   ScheduledSms가 이미 존재하면 중복 발송으로 판단한다.
 *   FAILED 상태는 재시도 허용 대상이므로 차단하지 않는다.
 *
 *   중복 발송이 발생할 수 있는 경로:
 *   a) 랜딩페이지 중복 신청 (동일 사용자가 폼을 여러 번 제출)
 *   b) 그룹 자동이동 + 수동 추가 레이스
 *   c) Webhook 재전송 (crm-payment / cruisedot-payment 중복 이벤트)
 *   d) 재트리거 API 호출 실수
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
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10) return ''; // 최소 10자리 (한국 번호)
  return digits;
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

// ---------------------------------------------------------------------------
// [2] 퍼널문자 멱등성 체크
// ---------------------------------------------------------------------------

export interface FunnelSmsIdempotencyResult {
  /** true = 이미 처리 중/완료 → 스킵해야 함 */
  isDuplicate: boolean;
  /** 발견된 기존 레코드 ID (로깅용) */
  existingId?: string;
  /** 발견된 기존 레코드 상태 (로깅용) */
  existingStatus?: string;
}

/**
 * 동일 contact + funnelSms 조합이 이미 PENDING/SENDING/SENT 상태로
 * 스케줄되어 있으면 중복 발송으로 판단한다.
 *
 * FAILED 상태는 재시도 허용이므로 차단하지 않는다.
 *
 * @param organizationId 테넌트 격리
 * @param contactId      대상 고객 ID
 * @param funnelSmsId    퍼널문자 ID
 */
export async function checkFunnelSmsIdempotency(
  organizationId: string,
  contactId: string,
  funnelSmsId: string
): Promise<FunnelSmsIdempotencyResult> {
  // PENDING/SENDING/SENT 상태의 기존 스케줄 존재 여부만 확인
  // FAILED는 재시도 허용 → 검색 조건에서 제외
  const existing = await prisma.scheduledSms.findFirst({
    where: {
      organizationId,
      contactId,
      channel: { startsWith: `FUNNEL_SMS:${funnelSmsId}:` },
      status: { in: ['PENDING', 'SENDING', 'SENT'] },
    },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return {
      isDuplicate: true,
      existingId: existing.id,
      existingStatus: existing.status,
    };
  }

  return { isDuplicate: false };
}
