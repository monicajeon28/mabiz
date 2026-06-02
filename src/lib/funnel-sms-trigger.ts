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

interface TriggerOptions {
  contactId:      string;
  groupId:        string;
  organizationId: string;
}

/**
 * KST 기준 sendHour/sendMinute을 UTC로 변환하는 헬퍼
 * KST = UTC+9 이므로 UTC = KST - 9
 */
function toUtcHour(kstHour: number): number {
  return (kstHour - 9 + 24) % 24;
}

export async function triggerGroupFunnelSms(opts: TriggerOptions): Promise<boolean> {
  const { contactId, groupId, organizationId } = opts;

  // 1. ContactGroup.funnelSmsId 조회
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId },
    select: { funnelSmsId: true, name: true },
  });
  if (!group?.funnelSmsId) return false;

  const funnelSmsId = group.funnelSmsId;

  // 2. FunnelSms + messages 조회
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
  if (!funnelSms || funnelSms.messages.length === 0) return false;

  // 3. Contact (phone, optOutAt) 확인
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { name: true, phone: true, optOutAt: true },
  });
  if (!contact || contact.optOutAt) return false;
  if (!contact.phone) {
    logger.log("[FunnelSmsTrigger] 전화번호 없는 고객 스킵", { contactId });
    return false;
  }

  // 4. 중복 방지: 동일 funnelSmsId로 이미 PENDING/SENT 스케줄이 있으면 false
  const existing = await prisma.scheduledSms.findFirst({
    where: {
      organizationId,
      contactId,
      channel: {
        startsWith: `FUNNEL_SMS:${funnelSmsId}:`,
      },
      status: { in: ["PENDING", "SENT"] },
    },
    select: { id: true },
  });
  if (existing) {
    logger.log("[FunnelSmsTrigger] 중복 퍼널문자 차단", {
      contactId,
      funnelSmsId,
    });
    return false;
  }

  // 5. 오늘 날짜 (KST 기준 자정 → UTC)
  const nowUtc = new Date();

  // KST 기준 오늘 0시를 UTC로 계산
  // KST 자정 = UTC 전날 15:00 → Date 기반 계산:
  // KST year/month/day 추출 후 UTC 저장 시 KST→UTC 오프셋(-9h) 적용
  const kstNow = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
  const kstYear  = kstNow.getUTCFullYear();
  const kstMonth = kstNow.getUTCMonth();  // 0-indexed
  const kstDay   = kstNow.getUTCDate();

  const utcSendHour   = toUtcHour(funnelSms.sendHour);
  const sendMinute    = funnelSms.sendMinute;

  // 6. 각 FunnelSmsMessage → ScheduledSms INSERT
  //    대량(최대 500회차) 대응: 개별 create() Promise.all 대신 단일 createMany 사용
  //    → 트랜잭션 1회 + INSERT 1회로 커넥션 풀 고갈/부분 실패 방지
  try {
    const data = funnelSms.messages.map((msg) => {
      // KST 기준 (오늘 + daysAfter)일의 sendHour:sendMinute
      // Date 생성: UTC 기준으로 KST 날짜 + UTC 오프셋 적용
      const scheduledAt = new Date(
        Date.UTC(kstYear, kstMonth, kstDay + msg.daysAfter, utcSendHour, sendMinute, 0, 0)
      );

      // channel: FUNNEL_SMS:{funnelSmsId}:{msgId} — 최대 61자
      const channel = `FUNNEL_SMS:${funnelSmsId}:${msg.id}`;

      // [이름] 치환 (null이면 빈 문자열)
      const message = msg.content.replace(/\[이름\]/g, contact.name ?? "");

      return {
        organizationId,
        contactId,
        groupId,
        message,
        scheduledAt,
        status: "PENDING",
        channel,
        // 대리점별 발신번호: FunnelSms.senderPhone이 있으면 개별 발송 번호로 사용,
        // 없으면 null → BatchSender에서 orgSmsConfig.senderPhone 기본값 폴백
        senderPhone: funnelSms.senderPhone ?? undefined,
      };
    });

    await prisma.scheduledSms.createMany({ data });

    logger.log("[FunnelSmsTrigger] 퍼널문자 스케줄 생성 완료", {
      contactId,
      funnelSmsId,
      funnelTitle: funnelSms.title,
      group:       group.name,
      count:       funnelSms.messages.length,
    });

    return true;
  } catch (err) {
    logger.error("[FunnelSmsTrigger] ScheduledSms 생성 실패", { err, contactId, funnelSmsId });
    return false;
  }
}
