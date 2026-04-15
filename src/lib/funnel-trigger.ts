/**
 * 퍼널 트리거 — 그룹 배정 시 자동 실행
 *
 * 흐름:
 *   고객 → 그룹 배정
 *   └─ 그룹에 funnelId 있으면 → VipCareSequence + VipCareLog 자동 생성
 *   └─ 즉시 발송 옵션 있으면 → 첫 번째 스테이지 즉시 발송
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";

interface TriggerOptions {
  contactId:      string;
  groupId:        string;
  organizationId: string;
  sendFirst?:     boolean; // 첫 번째 메시지 즉시 발송 여부
}

export async function triggerGroupFunnel(opts: TriggerOptions): Promise<boolean> {
  const { contactId, groupId, organizationId, sendFirst = false } = opts;

  // 그룹에 퍼널 연결 여부 확인
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId },
    select: { funnelId: true, name: true },
  });

  if (!group?.funnelId) return false; // 퍼널 없으면 스킵

  // 이미 이 퍼널로 진행 중인지 체크 (중복 방지)
  const existing = await prisma.vipCareSequence.findFirst({
    where: { contactId, funnelId: group.funnelId, status: "ACTIVE" },
  });
  if (existing) {
    logger.log("[FunnelTrigger] 이미 진행 중", { contactId, funnelId: group.funnelId });
    return false;
  }

  // 퍼널 + 스테이지 조회
  const funnel = await prisma.funnel.findFirst({
    where: { id: group.funnelId, isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!funnel || funnel.stages.length === 0) return false;

  // 고객 정보
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { name: true, phone: true, optOutAt: true },
  });
  if (!contact || contact.optOutAt) return false;

  const baseDate = new Date();

  // VipCareSequence + Log 생성
  const sequence = await prisma.vipCareSequence.create({
    data: {
      contactId,
      funnelId: funnel.id,
      startDate: baseDate,
      status: "ACTIVE",
      logs: {
        create: funnel.stages.map((stage) => {
          const scheduledAt = new Date(baseDate);
          scheduledAt.setUTCDate(scheduledAt.getUTCDate() + stage.triggerOffset);
          scheduledAt.setUTCHours(10, 0, 0, 0); // 오전 10시

          const content = stage.messageContent
            ? stage.messageContent
                .replace(/\[고객명\]/g, contact.name)
                .replace(/\[이름\]/g, contact.name)
            : null;

          return {
            stageOrder:  stage.order,
            scheduledAt,
            status:      "PENDING",
            content,
          };
        }),
      },
    },
    include: { logs: true },
  });

  logger.log("[FunnelTrigger] 퍼널 시작", {
    contactId, funnelId: funnel.id, group: group.name, stages: funnel.stages.length,
  });

  // 즉시 첫 번째 메시지 발송
  if (sendFirst) {
    const firstLog = sequence.logs.find((l) => l.stageOrder === 0);
    if (firstLog?.content) {
      const smsConfig = await getOrgSmsConfig(organizationId);
      if (smsConfig?.isActive) {
        const updated = await prisma.vipCareLog.updateMany({
          where: { id: firstLog.id, status: "PENDING" },
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
            msg:      firstLog.content,
            msgType:  firstLog.content.length > 90 ? "LMS" : "SMS",
          });
          await prisma.vipCareLog.update({
            where: { id: firstLog.id },
            data: { status: result.result_code === 1 ? "SENT" : "FAILED", sentAt: new Date() },
          });
          logger.log("[FunnelTrigger] 즉시 발송", {
            phone: contact.phone.substring(0, 4) + "***",
            code: result.result_code,
          });
        }
      }
    }
  }

  return true;
}
