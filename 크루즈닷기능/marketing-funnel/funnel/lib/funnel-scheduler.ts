/**
 * 퍼널 메시지 자동 예약 유틸리티
 * 고객이 그룹에 추가/이동될 때 해당 그룹의 퍼널 메시지를 자동으로 예약
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface FunnelScheduleOptions {
  leadId: number;
  groupId: number;
  profileId: number;
  userId: number;
}

/**
 * 파트너 그룹에 연결된 퍼널 메시지 자동 예약
 */
export async function schedulePartnerFunnelMessages({
  leadId,
  groupId,
  profileId,
  userId,
}: FunnelScheduleOptions): Promise<{ scheduled: number; error?: string }> {
  try {
    // 그룹의 퍼널 설정 조회
    const group = await prisma.partnerCustomerGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        funnelSmsIds: true,
        funnelTalkIds: true,
        funnelEmailIds: true,
      },
    });

    if (!group) {
      return { scheduled: 0, error: 'Group not found' };
    }

    // 연결된 퍼널 ID 수집
    const funnelIds: number[] = [];
    if (group.funnelSmsIds && Array.isArray(group.funnelSmsIds)) {
      funnelIds.push(...(group.funnelSmsIds as number[]));
    }
    if (group.funnelTalkIds && Array.isArray(group.funnelTalkIds)) {
      funnelIds.push(...(group.funnelTalkIds as number[]));
    }
    if (group.funnelEmailIds && Array.isArray(group.funnelEmailIds)) {
      funnelIds.push(...(group.funnelEmailIds as number[]));
    }

    if (funnelIds.length === 0) {
      return { scheduled: 0 };
    }

    // 연결된 퍼널 메시지 조회 (FunnelMessage 테이블)
    const funnelMessages = await prisma.funnelMessage.findMany({
      where: {
        id: { in: funnelIds },
        isActive: true,
      },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // 연결된 예약 메시지 조회 (ScheduledMessage 테이블 - 파트너 예약 메시지)
    const scheduledMessages = await prisma.scheduledMessage.findMany({
      where: {
        id: { in: funnelIds },
        isActive: true,
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (funnelMessages.length === 0 && scheduledMessages.length === 0) {
      return { scheduled: 0 };
    }

    // 고객 정보 조회 (이메일도 포함)
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      select: { id: true, customerName: true, customerPhone: true, customerEmail: true },
    });

    if (!lead) {
      return { scheduled: 0, error: 'Lead not found' };
    }

    // SMS 퍼널이 있는지 확인 (전화번호 필요)
    const hasSmsOrTalkFunnels = (group.funnelSmsIds && (group.funnelSmsIds as number[]).length > 0) ||
                                 (group.funnelTalkIds && (group.funnelTalkIds as number[]).length > 0);
    // Email 퍼널이 있는지 확인
    const hasEmailFunnels = group.funnelEmailIds && (group.funnelEmailIds as number[]).length > 0;

    // SMS/카카오톡 퍼널만 있는데 전화번호가 없으면 건너뛰기
    if (hasSmsOrTalkFunnels && !hasEmailFunnels && !lead.customerPhone) {
      logger.log(`[Funnel Scheduler] Lead ${leadId} has no phone, skipping SMS funnel scheduling`);
      return { scheduled: 0, error: 'Lead has no phone number' };
    }

    // Email 퍼널만 있는데 이메일이 없으면 건너뛰기
    if (hasEmailFunnels && !hasSmsOrTalkFunnels && !lead.customerEmail) {
      logger.log(`[Funnel Scheduler] Lead ${leadId} has no email, skipping email funnel scheduling`);
      return { scheduled: 0, error: 'Lead has no email' };
    }

    const now = new Date();
    let scheduledCount = 0;

    // FunnelMessage 기반 퍼널 예약 생성
    for (const funnel of funnelMessages) {
      for (const stage of funnel.FunnelMessageStage) {
        // 발송 예정일 계산: 그룹 유입일 + daysAfter
        const sendDate = new Date(now);
        sendDate.setDate(sendDate.getDate() + (stage.daysAfter || 0));

        // sendTime이 있으면 해당 시간으로 설정
        if (stage.sendTime) {
          const [hours, minutes] = stage.sendTime.split(':').map(Number);
          sendDate.setHours(hours, minutes, 0, 0);
        } else {
          // 기본 발송 시간: 오전 10시
          sendDate.setHours(10, 0, 0, 0);
        }

        // 이미 지난 시간이면 다음날 같은 시간으로 (0일차인 경우만)
        if (sendDate < now && stage.daysAfter === 0) {
          sendDate.setDate(sendDate.getDate() + 1);
        }

        // 예약 메시지 생성
        await prisma.adminMessage.create({
          data: {
            adminId: userId,
            userId: null,
            title: `[퍼널] ${funnel.title} - ${stage.stageNumber}단계`,
            content: stage.content,
            messageType: funnel.messageType || 'sms',
            isActive: true,
            sendAt: sendDate,
            metadata: {
              funnelMessageId: funnel.id,
              funnelStageId: stage.id,
              stageNumber: stage.stageNumber,
              daysAfter: stage.daysAfter,
              groupId: groupId,
              groupName: group.name,
              leadId: leadId,
              leadName: lead.customerName,
              leadPhone: lead.customerPhone,
              leadEmail: lead.customerEmail,
              profileId: profileId,
              imageUrl: stage.imageUrl,
              source: 'partner_funnel',
            },
          },
        });

        scheduledCount++;
        logger.log(
          `[Funnel Scheduler] Created: funnel=${funnel.id}, stage=${stage.stageNumber}, lead=${leadId}, sendAt=${sendDate.toISOString()}`
        );
      }
    }

    // ScheduledMessage 기반 퍼널 예약 생성 (파트너 예약 메시지)
    for (const scheduled of scheduledMessages) {
      for (const stage of scheduled.ScheduledMessageStage) {
        // 발송 예정일 계산: 그룹 유입일 + daysAfter
        const sendDate = new Date(now);
        sendDate.setDate(sendDate.getDate() + (stage.daysAfter || 0));

        // sendTime이 있으면 해당 시간으로 설정
        if (stage.sendTime) {
          const [hours, minutes] = stage.sendTime.split(':').map(Number);
          sendDate.setHours(hours, minutes, 0, 0);
        } else if (scheduled.startTime) {
          const [hours, minutes] = scheduled.startTime.split(':').map(Number);
          sendDate.setHours(hours, minutes, 0, 0);
        } else {
          // 기본 발송 시간: 오전 10시
          sendDate.setHours(10, 0, 0, 0);
        }

        // 이미 지난 시간이면 다음날 같은 시간으로 (0일차인 경우만)
        if (sendDate < now && stage.daysAfter === 0) {
          sendDate.setDate(sendDate.getDate() + 1);
        }

        // 예약 메시지 생성
        await prisma.adminMessage.create({
          data: {
            adminId: userId,
            userId: null,
            title: `[퍼널] ${scheduled.title} - ${stage.stageNumber}단계`,
            content: stage.content,
            messageType: scheduled.sendMethod || 'sms',
            isActive: true,
            sendAt: sendDate,
            metadata: {
              scheduledMessageId: scheduled.id,
              scheduledStageId: stage.id,
              stageNumber: stage.stageNumber,
              daysAfter: stage.daysAfter,
              groupId: groupId,
              groupName: group.name,
              leadId: leadId,
              leadName: lead.customerName,
              leadPhone: lead.customerPhone,
              leadEmail: lead.customerEmail,
              profileId: profileId,
              senderName: scheduled.senderName,
              senderPhone: scheduled.senderPhone,
              senderEmail: scheduled.senderEmail,
              isAdMessage: scheduled.isAdMessage,
              source: 'partner_scheduled',
            },
          },
        });

        scheduledCount++;
        logger.log(
          `[Funnel Scheduler] Created: scheduled=${scheduled.id}, stage=${stage.stageNumber}, lead=${leadId}, sendAt=${sendDate.toISOString()}`
        );
      }
    }

    return { scheduled: scheduledCount };
  } catch (error: any) {
    logger.error('[Funnel Scheduler] Error:', error);
    return { scheduled: 0, error: error.message };
  }
}

/**
 * 관리자 그룹에 연결된 퍼널 메시지 자동 예약
 */
export async function scheduleAdminFunnelMessages({
  userId,
  groupId,
  adminId,
}: {
  userId: number;
  groupId: number;
  adminId: number;
}): Promise<{ scheduled: number; error?: string }> {
  try {
    // 그룹의 퍼널 설정 조회
    const group = await prisma.customerGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        funnelSmsIds: true,
        funnelTalkIds: true,
        funnelEmailIds: true,
      },
    });

    if (!group) {
      return { scheduled: 0, error: 'Group not found' };
    }

    // 연결된 퍼널 ID 수집
    const funnelIds: number[] = [];

    const parseFunnelIds = (ids: any): number[] => {
      if (!ids) return [];
      if (typeof ids === 'string') {
        try {
          const parsed = JSON.parse(ids);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return Array.isArray(ids) ? ids : [];
    };

    funnelIds.push(...parseFunnelIds(group.funnelSmsIds));
    funnelIds.push(...parseFunnelIds(group.funnelTalkIds));
    funnelIds.push(...parseFunnelIds(group.funnelEmailIds));

    if (funnelIds.length === 0) {
      return { scheduled: 0 };
    }

    // 연결된 퍼널 메시지 조회
    const funnelMessages = await prisma.funnelMessage.findMany({
      where: {
        id: { in: funnelIds },
        isActive: true,
      },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (funnelMessages.length === 0) {
      return { scheduled: 0 };
    }

    const now = new Date();
    let scheduledCount = 0;

    // 각 퍼널 메시지의 각 단계에 대해 예약 생성
    for (const funnel of funnelMessages) {
      for (const stage of funnel.FunnelMessageStage) {
        const sendDate = new Date(now);
        sendDate.setDate(sendDate.getDate() + (stage.daysAfter || 0));

        if (stage.sendTime) {
          const [hours, minutes] = stage.sendTime.split(':').map(Number);
          sendDate.setHours(hours, minutes, 0, 0);
        } else {
          sendDate.setHours(10, 0, 0, 0);
        }

        if (sendDate < now && stage.daysAfter === 0) {
          sendDate.setDate(sendDate.getDate() + 1);
        }

        await prisma.adminMessage.create({
          data: {
            adminId: adminId,
            userId: userId,
            title: `[퍼널] ${funnel.title} - ${stage.stageNumber}단계`,
            content: stage.content,
            messageType: funnel.messageType || 'sms',
            isActive: true,
            sendAt: sendDate,
            metadata: {
              funnelMessageId: funnel.id,
              funnelStageId: stage.id,
              stageNumber: stage.stageNumber,
              daysAfter: stage.daysAfter,
              groupId: groupId,
              groupName: group.name,
              imageUrl: stage.imageUrl,
              source: 'admin_funnel',
            },
          },
        });

        scheduledCount++;
        logger.log(
          `[Funnel Scheduler] Admin: funnel=${funnel.id}, stage=${stage.stageNumber}, user=${userId}, sendAt=${sendDate.toISOString()}`
        );
      }
    }

    return { scheduled: scheduledCount };
  } catch (error: any) {
    logger.error('[Funnel Scheduler] Admin Error:', error);
    return { scheduled: 0, error: error.message };
  }
}
