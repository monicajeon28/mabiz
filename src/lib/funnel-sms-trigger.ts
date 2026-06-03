/**
 * 퍼널문자(FunnelSms) 트리거
 *
 * 동작 방식:
 *   - 그룹에 연결된 FunnelSms 조회
 *   - FunnelSmsMessage 각 회차의 daysAfter + sendHour/sendMinute 기준으로
 *     ScheduledSms를 생성 (Cron이 PENDING 상태를 읽어 자동 발송)
 *
 * 호출 시점:
 *   - 랜딩페이지 신청 → triggerGroupFunnelSms()
 *   - 그룹 멤버 추가 → triggerGroupFunnelSms()
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { validateSenderPhone, checkFunnelSmsIdempotency } from "@/lib/funnel-sms-helpers";

interface TriggerOptions {
  contactId:      string;
  groupId:        string;
  organizationId: string;
  /**
   * 선택사항: 특정 FunnelSms만 발송.
   * 없으면 그룹의 funnelSmsIds[] (다중) → funnelSmsId (레거시 단일) 순으로 폴백.
   */
  funnelSmsId?:   string;
}

/**
 * KST 기준 sendHour/sendMinute을 UTC로 변환하는 헬퍼
 * KST = UTC+9 이므로 UTC = KST - 9
 */
function toUtcHour(kstHour: number): number {
  return (kstHour - 9 + 24) % 24;
}

export async function triggerGroupFunnelSms(opts: TriggerOptions): Promise<boolean> {
  const { contactId, groupId, organizationId, funnelSmsId: targetFunnelSmsId } = opts;

  // 1. ContactGroup 조회 (다중 funnelSmsIds[] + 레거시 funnelSmsId)
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId },
    select: { name: true, funnelSmsIds: true, funnelSmsId: true },
  });
  if (!group) return false;

  // 2. 발송할 FunnelSmsId 결정 (targetFunnelSmsId > funnelSmsIds[] > funnelSmsId)
  let funnelSmsIds: string[] = [];
  if (targetFunnelSmsId) {
    funnelSmsIds = [targetFunnelSmsId];
  } else if (group.funnelSmsIds && group.funnelSmsIds.length > 0) {
    funnelSmsIds = group.funnelSmsIds;
  } else if (group.funnelSmsId) {
    funnelSmsIds = [group.funnelSmsId];
  }
  // 중복 제거 (배열에 동일 ID가 들어가면 동일 채널 충돌)
  funnelSmsIds = Array.from(new Set(funnelSmsIds));
  if (funnelSmsIds.length === 0) return false;

  // 3. Contact (phone, optOutAt) 확인 — 한 번만 조회
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { name: true, phone: true, optOutAt: true },
  });
  if (!contact || contact.optOutAt) return false;
  if (!contact.phone) {
    logger.log("[FunnelSmsTrigger] 전화번호 없는 고객 스킵", { contactId });
    return false;
  }

  // 4. 오늘 날짜 (KST 기준 자정 → UTC) — 모든 FunnelSms 공통
  const nowUtc = new Date();
  const kstNow = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
  const kstYear  = kstNow.getUTCFullYear();
  const kstMonth = kstNow.getUTCMonth();  // 0-indexed
  const kstDay   = kstNow.getUTCDate();

  // 5. 각 FunnelSms마다 스케줄 생성 (개별 실패 격리)
  let successCount = 0;
  for (const funnelSmsId of funnelSmsIds) {
    try {
      // 5-1. 멱등성 체크: PENDING/SENDING/SENT 상태 스케줄이 이미 있으면 스킵
      // (FAILED는 재시도 허용 → 차단하지 않음)
      // 중복 발송 경로: 랜딩 중복신청, 그룹이동 레이스, Webhook 재전송, 재트리거 API
      const idempotency = await checkFunnelSmsIdempotency(organizationId, contactId, funnelSmsId);
      if (idempotency.isDuplicate) {
        logger.log("[FunnelSmsTrigger] 중복 퍼널문자 차단 (멱등성)", {
          contactId,
          funnelSmsId,
          existingId: idempotency.existingId,
          existingStatus: idempotency.existingStatus,
        });
        continue;
      }

      // 5-2. FunnelSms + messages 조회
      const funnelSms = await prisma.funnelSms.findFirst({
        where: { id: funnelSmsId, organizationId, isActive: true },
        select: {
          id:          true,
          title:       true,
          sendHour:    true,
          sendMinute:  true,
          senderPhone: true,
          messages: {
            orderBy: { order: "asc" },
            select: {
              id:        true,
              order:     true,
              daysAfter: true,
              content:   true,
              msgType:   true,
            },
          },
        },
      });
      if (!funnelSms || funnelSms.messages.length === 0) continue;

      const utcSendHour = toUtcHour(funnelSms.sendHour);
      const sendMinute  = funnelSms.sendMinute;

      // 5-2-b. [P0 보안] 발신번호 검증 — 미등록/미검증 번호로 발송 방지(발신번호 변작)
      // 검증 실패 시 org 기본 발신번호로 폴백(undefined면 BatchSender가 다시 폴백)
      const phoneValidation = await validateSenderPhone(organizationId, funnelSms.senderPhone);
      if (!phoneValidation.valid) {
        logger.warn("[FunnelSmsTrigger] 미검증 발신번호 폴백 적용", {
          organizationId,
          funnelSmsId,
          attempted: funnelSms.senderPhone,
          fallback: phoneValidation.fallbackPhone,
        });
      }
      const resolvedSenderPhone = phoneValidation.fallbackPhone ?? undefined;
      if (!resolvedSenderPhone && funnelSms.senderPhone) {
        logger.error("[FunnelSmsTrigger] 발신번호 검증 완전 실패 (폴백 불가)", {
          funnelSmsId,
          organizationId,
          senderPhone: funnelSms.senderPhone,
        });
        continue; // 이 FunnelSms 스킵, 나머지는 계속
      }

      // 5-3. 각 FunnelSmsMessage → ScheduledSms INSERT (단일 createMany)
      const data = funnelSms.messages.map((msg) => {
        let scheduledAt = new Date(
          Date.UTC(kstYear, kstMonth, kstDay + msg.daysAfter, utcSendHour, sendMinute, 0, 0)
        );
        // P0-2: 과거시각 보정 — 신청 시각 이전(예: Day 0 + 설정시각이 신청시각보다 이른 경우)이면
        // 다음 날 동일 설정시각으로 미뤄 과거 발송(Cron 즉시 발송)을 방지한다.
        if (scheduledAt <= nowUtc) {
          scheduledAt = new Date(
            Date.UTC(kstYear, kstMonth, kstDay + msg.daysAfter + 1, utcSendHour, sendMinute, 0, 0)
          );
        }
        const channel = `FUNNEL_SMS:${funnelSmsId}:${msg.id}`;
        const message = msg.content.replace(/\[이름\]/g, contact.name ?? "");

        return {
          organizationId,
          contactId,
          groupId,
          message,
          scheduledAt,
          status: "PENDING" as const,
          channel,
          // 대리점별 발신번호(검증 통과분만): 없으면 BatchSender에서 orgSmsConfig.senderPhone 폴백
          senderPhone: resolvedSenderPhone,
        };
      });

      if (data.length === 0) continue;
      // [P1-2] 레이스 컨디션 방지: 부분 UNIQUE 인덱스(uniq_scheduled_sms_funnel_channel)와
      // 함께 skipDuplicates로 동시 트리거 시 중복 INSERT(2중 발송)를 DB 레이어에서 차단.
      // 위 5-1 findFirst 선체크는 빠른 경로용이며, 최종 방어선은 이 DB 제약이다.
      const createResult = await prisma.scheduledSms.createMany({ data, skipDuplicates: true });
      if (createResult.count < data.length) {
        logger.warn("[FunnelSmsTrigger] 중복 스케줄 일부 무시됨(레이스 차단)", {
          contactId,
          funnelSmsId,
          attempted: data.length,
          inserted: createResult.count,
        });
      }
      successCount++;

      logger.log("[FunnelSmsTrigger] 퍼널문자 스케줄 생성 완료", {
        contactId,
        funnelSmsId,
        funnelTitle: funnelSms.title,
        group:       group.name,
        count:       funnelSms.messages.length,
      });
    } catch (err) {
      // 한 FunnelSms 실패가 나머지 발송을 막지 않도록 격리
      logger.error("[FunnelSmsTrigger] 개별 FunnelSms 처리 실패", { err, contactId, funnelSmsId });
    }
  }

  return successCount > 0;
}
