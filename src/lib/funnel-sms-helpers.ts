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
import type { AuthContext } from '@/lib/rbac';
import { resolveOrgId } from '@/lib/rbac';

// ---------------------------------------------------------------------------
// [0] 퍼널문자 per-user 격리 (FunnelSms 소유권/공유 필터)
// ---------------------------------------------------------------------------
//
// buildContactWhere(rbac.ts)와 동일 철학의 3단 격리:
//   - GLOBAL_ADMIN : resolveOrgId(=BONSA_ORG_ID) 범위 전체 (org 해석 기존 유지)
//   - OWNER(대리점장): 소속 organizationId 범위 전체
//   - AGENT(판매원)  : organizationId 범위 안에서
//        (1) 본인이 만든 것(createdByUserId === userId)
//        (2) 공유된 것(visibility TEAM/PUBLIC 이거나 sharedWith 에 본인 포함)
//        (3) 조직공용/시드 템플릿(createdByUserId IS NULL 또는 isTemplate)
//      → 기존 시드/공용 퍼널이 판매원에게서 사라지지 않도록 보호.
//
// 사용처: GET 목록(route.ts), 단건/PATCH/DELETE([id]), messages PUT/sync,
//         stats, sent-history — 타인 퍼널 조회·편집 차단.

/**
 * 역할별 FunnelSms 격리 WHERE 조각을 반환한다.
 * 항상 organizationId(resolveOrgId 결과)를 포함하므로 테넌트 격리는 유지된다.
 * AGENT일 때만 추가로 소유권/공유 OR 조건을 덧붙인다.
 *
 * @param ctx   인증 컨텍스트
 * @param extra 호출부 추가 조건(groupId/검색 등). OR 키를 포함하지 말 것(AGENT OR와 충돌).
 */
export function buildFunnelSmsWhere(
  ctx: AuthContext,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const orgId = resolveOrgId(ctx);

  // GLOBAL_ADMIN / OWNER: 조직 범위 전체 (org 해석은 resolveOrgId가 담당)
  if (ctx.role === 'GLOBAL_ADMIN' || ctx.role === 'OWNER') {
    return { ...extra, organizationId: orgId };
  }

  // AGENT(및 그 외): 본인 소유 + 공유 + 조직공용/시드 템플릿
  // 호출부가 extra.OR을 넣지 않는 계약. 혹시 들어오면 분리 병합한다.
  const { OR: extraOR, ...restExtra } = extra as {
    OR?: Record<string, unknown>[];
    [k: string]: unknown;
  };

  const ownershipOR: Record<string, unknown>[] = [
    { createdByUserId: ctx.userId }, // (1) 본인 소유
    { visibility: { in: ['TEAM', 'PUBLIC'] } }, // (2-a) 팀/공개 공유
    { sharedWith: { has: ctx.userId } }, // (2-b) 명시적 공유 대상
    { createdByUserId: null }, // (3-a) 시드/조직공용(소유자 미상)
    { isTemplate: true }, // (3-b) 조직 공용 템플릿
  ];

  // extra가 자체 OR을 가지면 AND로 결합 (organizationId AND (소유OR) AND (extraOR))
  if (extraOR && extraOR.length > 0) {
    return {
      ...restExtra,
      organizationId: orgId,
      AND: [{ OR: ownershipOR }, { OR: extraOR }],
    };
  }

  return {
    ...restExtra,
    organizationId: orgId,
    OR: ownershipOR,
  };
}

/**
 * 단건 소유권 검증 — [id] 라우트에서 대상 FunnelSms에 대한 접근/편집 권한 확인.
 * buildFunnelSmsWhere로 격리된 findFirst를 수행해 권한 없는 id면 null 반환.
 *
 * @returns 접근 가능하면 { id } 객체, 없으면 null (404 처리용)
 */
export async function findAccessibleFunnelSms(
  ctx: AuthContext,
  id: string
): Promise<{ id: string } | null> {
  const where = buildFunnelSmsWhere(ctx, { id });
  return prisma.funnelSms.findFirst({
    where: where as never,
    select: { id: true },
  });
}

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

/**
 * 그룹 재유입 시 유입시각(addedAt)을 리셋해 "0일차부터 다시 시작"할지 판정.
 * - RESET_TIME_KEEP_DATA / RESET_ALL_RESTART = 유입시각 갱신 → 퍼널문자 시퀀스 재시작
 * - KEEP_TIME_KEEP_DATA(기본) = 최초 입력일 유지 → 재발송 안 함
 */
export function shouldResetOnReentry(reEntryPolicy: string | null | undefined): boolean {
  return reEntryPolicy === 'RESET_TIME_KEEP_DATA' || reEntryPolicy === 'RESET_ALL_RESTART';
}

export interface FunnelSmsIdempotencyResult {
  /** true = 이미 처리 중/완료 → 스킵해야 함 */
  isDuplicate: boolean;
  /** 발견된 기존 레코드 ID (로깅용) */
  existingId?: string;
  /** 발견된 기존 레코드 상태 (로깅용) */
  existingStatus?: string;
}

/**
 * 동일 contact + funnelSms + 유입 에피소드(anchorEpoch) 조합이 이미
 * PENDING/SENDING/SENT 상태로 스케줄되어 있으면 중복 발송으로 판단한다.
 *
 * 에피소드 단위 멱등성:
 *   channel 포맷이 `FUNNEL_SMS:{funnelSmsId}:{msgId}:{anchorEpoch}` 이므로,
 *   같은 유입(=같은 addedAt epoch)에 대해서만 중복으로 차단한다.
 *   재유입으로 addedAt이 갱신되면(RESET 정책) epoch가 달라져 새 시퀀스가 허용된다
 *   → "0일차부터 다시 시작".
 *
 * FAILED 상태는 재시도 허용이므로 차단하지 않는다.
 *
 * @param organizationId 테넌트 격리
 * @param contactId      대상 고객 ID
 * @param funnelSmsId    퍼널문자 ID
 * @param anchorEpoch    유입 기준일(addedAt) epoch ms — 에피소드 식별
 */
export async function checkFunnelSmsIdempotency(
  organizationId: string,
  contactId: string,
  funnelSmsId: string,
  anchorEpoch: number
): Promise<FunnelSmsIdempotencyResult> {
  // 같은 funnelSms + 같은 유입 에피소드(epoch)의 PENDING/SENDING/SENT 만 중복 판정.
  // FAILED는 재시도 허용 → 검색 조건에서 제외.
  //
  // [안전강화] funnelSmsId는 정규 컬럼으로 정확 매칭(인덱스 활용), 에피소드는
  // channel 마지막 토큰(epoch)을 정확 비교한다. channel LIKE 부분매칭(startsWith/
  // endsWith)에 의존하지 않아 msgId 꼬리/접두사 우연 일치로 인한 오판을 차단한다.
  const candidates = await prisma.scheduledSms.findMany({
    where: {
      organizationId,
      contactId,
      funnelSmsId, // 정규 컬럼 정확 매칭 (@@index([funnelSmsMessageId, status]) 외 funnelSmsId 인덱스 활용)
      status: { in: ['PENDING', 'SENDING', 'SENT'] },
    },
    select: { id: true, status: true, channel: true },
    orderBy: { createdAt: 'desc' },
  });

  const epochStr = String(anchorEpoch);
  const existing = candidates.find((c) => {
    const parts = (c.channel ?? '').split(':');
    // channel = FUNNEL_SMS:{funnelSmsId}:{msgId}:{epoch} → 마지막 토큰이 이 유입의 epoch와 정확히 일치
    return parts[parts.length - 1] === epochStr;
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
