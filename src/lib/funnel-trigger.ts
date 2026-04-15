/**
 * 퍼널 트리거
 *
 * 동작 방식:
 *   - triggerType = "DDAY"       → contact.departureDate 기준으로 D-150, D-90... 계산
 *   - triggerType = "DAYS_AFTER" → 오늘부터 N일 후
 *
 * 판매원이 할 것: 출발일 입력 + 그룹 배정
 * 자동으로 되는 것: 발송 날짜 계산 + Cron 자동 발송
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";

interface TriggerOptions {
  contactId:      string;
  groupId:        string;
  organizationId: string;
  sendFirst?:     boolean;
}

export async function triggerGroupFunnel(opts: TriggerOptions): Promise<boolean> {
  const { contactId, groupId, organizationId, sendFirst = false } = opts;

  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId },
    select: { funnelId: true, name: true },
  });
  if (!group?.funnelId) return false;

  // 중복 방지
  const existing = await prisma.vipCareSequence.findFirst({
    where: { contactId, funnelId: group.funnelId, status: "ACTIVE" },
  });
  if (existing) return false;

  const funnel = await prisma.funnel.findFirst({
    where: { id: group.funnelId, isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!funnel || funnel.stages.length === 0) return false;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { name: true, phone: true, optOutAt: true, departureDate: true, productName: true },
  });
  if (!contact || contact.optOutAt) return false;

  // [RISK-01] departureDate 없는 고객 → DDAY 퍼널 배정 차단
  const hasDdayStage = funnel.stages.some((s) => s.triggerType === "DDAY");
  if (hasDdayStage && !contact.departureDate) {
    logger.log('[FunnelTrigger] departureDate 없는 고객 DDAY 퍼널 차단', {
      contactId,
      funnelId: funnel.id,
    });
    return false;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // 스테이지별 발송 날짜 계산
  const logData = funnel.stages.map((stage) => {
    let scheduledAt: Date;

    if (stage.triggerType === "DDAY") {
      // D-day 기준: contact.departureDate 사용
      // 출발일이 없으면 오늘 기준 계산 (임시)
      const baseDate = contact.departureDate
        ? new Date(contact.departureDate)
        : new Date();
      baseDate.setUTCHours(0, 0, 0, 0);

      scheduledAt = new Date(baseDate);
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() + stage.triggerOffset);
    } else {
      // DAYS_AFTER: 오늘부터 N일 후
      scheduledAt = new Date(today);
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() + stage.triggerOffset);
    }

    scheduledAt.setUTCHours(10, 0, 0, 0); // 오전 10시

    // 과거 날짜면 스킵 표시
    const isPast = scheduledAt < today;

    // 개인화 치환
    const content = stage.messageContent
      ? stage.messageContent
          .replace(/\[고객명\]/g, contact.name)
          .replace(/\[이름\]/g,   contact.name)
          .replace(/\[상품명\]/g, contact.productName ?? "크루즈")
          .replace(/\[링크\]/g, '') // linkUrl 필드 미존재 — 추후 FunnelStage 타입에 추가 예정
      : null;

    return {
      stageOrder:  stage.order,
      scheduledAt,
      status:      isPast ? "SKIPPED" : "PENDING",
      content,
    };
  });

  const sequence = await prisma.vipCareSequence.create({
    data: {
      contactId,
      funnelId:    funnel.id,
      startDate:   today,
      status:      "ACTIVE",
      logs:        { create: logData },
    },
    include: { logs: true },
  });

  logger.log("[FunnelTrigger] 퍼널 시작", {
    contactId,
    funnelId:   funnel.id,
    group:      group.name,
    stages:     funnel.stages.length,
    departure:  contact.departureDate?.toISOString().split("T")[0] ?? "미지정",
  });

  // 즉시 첫 번째 메시지 발송 (PENDING 상태인 것만)
  if (sendFirst) {
    const firstPending = sequence.logs
      .filter((l) => l.status === "PENDING")
      .sort((a, b) => a.stageOrder - b.stageOrder)[0];

    if (firstPending?.content) {
      const smsConfig = await getOrgSmsConfig(organizationId);
      if (smsConfig?.isActive) {
        const updated = await prisma.vipCareLog.updateMany({
          where: { id: firstPending.id, status: "PENDING" },
          data:  { status: "SENDING" },
        });
        if (updated.count > 0) {
          const result = await sendSms({
            config: {
              key:    smsConfig.aligoKey,
              userId: smsConfig.aligoUserId,
              sender: smsConfig.senderPhone,
            },
            receiver: contact.phone,
            msg:      firstPending.content,
            msgType:  firstPending.content.length > 90 ? "LMS" : "SMS",
          });
          await prisma.vipCareLog.update({
            where: { id: firstPending.id },
            data:  { status: result.result_code === 1 ? "SENT" : "FAILED", sentAt: new Date() },
          });
        }
      }
    }
  }

  return true;
}
