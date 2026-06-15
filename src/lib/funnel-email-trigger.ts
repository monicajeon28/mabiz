/**
 * 퍼널이메일(GroupEmailFunnel) 트리거
 *
 * 동작 방식:
 *   - 그룹에 연결된 GroupEmailFunnel 조회 (isActive: true)
 *   - GroupEmailConfig 검증 (isActive: true, isVerified: true)
 *   - Contact 이메일 확인 + 수신거부(optOutAt) 체크
 *   - 멱등성 체크: 동일 contactId + groupId + day 조합 PENDING 레코드 있으면 스킵
 *   - GroupEmailFunnelMessage (Day 0-3) → ScheduledEmailMessage 레코드 생성
 *   - Day 0: anchorDate 기준 즉시 (1초 안전마진)
 *     Day 1: anchorDate + 1일 오전 10시 KST
 *     Day 2: anchorDate + 2일 오후 2시 KST
 *     Day 3: anchorDate + 3일 오전 10시 KST
 *   - variables 필드에 Contact 변수 저장 (발송 시점 Cron이 치환)
 *
 * 호출 시점:
 *   - 랜딩페이지 신청 → group-join API → triggerGroupEmailFunnel()
 *   - 그룹 멤버 추가 → triggerGroupEmailFunnel()
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// dayjs 플러그인 활성화 (KST 타임존 지원)
dayjs.extend(utc);
dayjs.extend(timezone);

// KST 타임존 상수
const KST_TZ = "Asia/Seoul";

// Day별 발송 시각 (KST 기준)
// Day 0: 즉시 (별도 처리), Day 1/3: 오전 10시, Day 2: 오후 2시
const DAY_SEND_HOURS: Record<number, number> = {
  1: 10,
  2: 14,
  3: 10,
};

export interface EmailTriggerOptions {
  contactId: string;
  groupId: string;
  organizationId: string;
  /** 기준일 (없으면 현재시각) */
  anchorDate?: Date;
  /**
   * 재유입 정책 — group.reEntryPolicy 값을 그대로 전달
   * 'RESET_TIME_KEEP_DATA' | 'RESET_TIME_RESET_DATA' 등 'RESET'이 포함되면
   * 기존 PENDING 이메일을 CANCELLED 처리 후 재스케줄링.
   * 미전달 또는 'KEEP_*' 계열이면 기존 PENDING이 있을 때 스킵 (기존 동작).
   */
  reEntryPolicy?: string;
}

/**
 * 그룹의 활성 이메일 퍼널을 트리거하여 ScheduledEmailMessage 레코드를 생성합니다.
 *
 * @returns true: 스케줄 생성 성공 | false: 이메일 퍼널 미설정 또는 조건 불충족
 */
export async function triggerGroupEmailFunnel(
  opts: EmailTriggerOptions
): Promise<boolean> {
  const { contactId, groupId, organizationId, reEntryPolicy } = opts;
  const isReset = typeof reEntryPolicy === "string" && reEntryPolicy.includes("RESET");

  // 1. GroupEmailFunnel 조회 (isActive: true)
  const emailFunnel = await prisma.groupEmailFunnel.findFirst({
    where: { groupId, organizationId, isActive: true },
    select: {
      id: true,
      title: true,
      emailConfigId: true,
      createdByUserId: true,
      messages: {
        orderBy: [{ day: "asc" }, { order: "asc" }],
        select: {
          id: true,
          day: true,
          order: true,
          pasonaStage: true,
          subject: true,
          bodyHtml: true,
          previewText: true,
        },
      },
    },
  });

  if (!emailFunnel) {
    // 이메일 퍼널 미설정 — 정상 케이스, 조용히 false 반환
    return false;
  }

  if (emailFunnel.messages.length === 0) {
    logger.log("[EmailFunnelTrigger] 메시지 없는 퍼널 스킵", {
      emailFunnelId: emailFunnel.id,
      groupId,
    });
    return false;
  }

  // 2. GroupEmailConfig 검증 (isActive: true, isVerified: true)
  const emailConfig = await prisma.groupEmailConfig.findFirst({
    where: {
      id: emailFunnel.emailConfigId,
      organizationId,
      isActive: true,
      isVerified: true,
    },
    select: { id: true, emailProvider: true },
  });

  if (!emailConfig) {
    logger.log(
      "[EmailFunnelTrigger] 이메일 설정 미완료 스킵 (isActive/isVerified 필요)",
      {
        emailFunnelId: emailFunnel.id,
        emailConfigId: emailFunnel.emailConfigId,
        groupId,
      }
    );
    return false;
  }

  // 3. Contact 정보 조회
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      optOutAt: true,
    },
  });

  if (!contact) {
    logger.warn("[EmailFunnelTrigger] Contact 없음", { contactId });
    return false;
  }

  // 4. 수신거부 체크
  if (contact.optOutAt) {
    logger.log("[EmailFunnelTrigger] 수신거부 고객 스킵", { contactId });
    return false;
  }

  // 5. 이메일 주소 확인
  if (!contact.email) {
    logger.log("[EmailFunnelTrigger] 이메일 없는 고객 스킵", { contactId });
    return false;
  }

  // 그룹명 조회 (variables에 저장용)
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId },
    select: { name: true },
  });

  // 6. 멱등성 체크 / RESET 처리
  //    - RESET 정책: 기존 PENDING 이메일을 모두 CANCELLED 처리 → 새 스케줄 생성 진행 (SMS와 동일)
  //    - KEEP 정책(기본): 기존 PENDING이 있으면 스킵 (기존 동작 유지)
  const existingPendingIds = await prisma.scheduledEmailMessage.findMany({
    where: {
      organizationId,
      contactId,
      groupId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existingPendingIds.length > 0) {
    if (isReset) {
      // RESET 정책: 기존 PENDING 취소 후 재스케줄링 (SMS와 동일한 동작)
      await prisma.scheduledEmailMessage.updateMany({
        where: {
          id: { in: existingPendingIds.map((r) => r.id) },
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      });
      logger.log(
        "[EmailFunnelTrigger] RESET 정책: 기존 PENDING 이메일 CANCELLED 처리 후 재스케줄링",
        {
          contactId,
          groupId,
          cancelledCount: existingPendingIds.length,
        }
      );
    } else {
      // KEEP 정책(기본): 스킵
      logger.log("[EmailFunnelTrigger] 중복 이메일 퍼널 스킵 (멱등성)", {
        contactId,
        groupId,
        existingId: existingPendingIds[0].id,
      });
      return false;
    }
  }

  // 7. 기준일(anchorDate) → KST 날짜 분해
  const nowUtc = new Date();
  const anchor = opts.anchorDate ?? nowUtc;

  const kstAnchorDayjs = dayjs(anchor).tz(KST_TZ);
  const kstYear  = kstAnchorDayjs.year();
  const kstMonth = kstAnchorDayjs.month(); // 0-indexed
  const kstDay   = kstAnchorDayjs.date();

  // 8. Contact 변수 구성 (발송 시점 Cron이 {{name}} 등 치환)
  const variables = {
    name:      contact.name   ?? "",
    email:     contact.email,
    phone:     contact.phone  ?? "",
    groupName: group?.name    ?? "",
  };

  // 9. Day별 메시지 → ScheduledEmailMessage 생성 데이터 구성
  const recordsToCreate = emailFunnel.messages.map((msg) => {
    let scheduledAt: Date;

    if (msg.day === 0) {
      // Day 0: 즉시 발송 (1초 안전마진)
      scheduledAt = new Date(nowUtc.getTime() + 1_000);
    } else {
      // Day 1+: KST 벽시계 시각으로 계산
      const sendHour   = DAY_SEND_HOURS[msg.day] ?? 10;
      const targetDay  = kstDay + msg.day;
      const kstTargetDayjs = dayjs()
        .tz(KST_TZ)
        .year(kstYear)
        .month(kstMonth)
        .date(targetDay)
        .hour(sendHour)
        .minute(0)
        .second(0)
        .millisecond(0);

      scheduledAt = kstTargetDayjs.toDate();

      // 과거시각 보정: 계산 결과가 현재보다 이르면 다음 날로 미룸
      if (scheduledAt <= nowUtc) {
        scheduledAt = kstTargetDayjs.add(1, "day").toDate();
      }
    }

    return {
      organizationId,
      contactId,
      groupId,
      day:          msg.day,
      subject:      msg.subject,   // {{name}} 등 동적변수 원본 그대로 저장
      htmlContent:  msg.bodyHtml,  // Cron 발송 시 치환
      variables:    variables as Record<string, string>,
      status:       "PENDING" as const,
      scheduledAt,
      provider:     emailConfig.emailProvider,
      senderUserId: emailFunnel.createdByUserId,  // resolveUserEmailConfig에서 개인 SMTP 조회용
    };
  });

  if (recordsToCreate.length === 0) return false;

  // 10. DB INSERT (createMany)
  const createResult = await prisma.scheduledEmailMessage.createMany({
    data: recordsToCreate,
    skipDuplicates: true,
  });

  logger.log("[EmailFunnelTrigger] 이메일 퍼널 스케줄 생성 완료", {
    contactId,
    groupId,
    emailFunnelId: emailFunnel.id,
    funnelTitle:   emailFunnel.title,
    attempted:     recordsToCreate.length,
    inserted:      createResult.count,
    provider:      emailConfig.emailProvider,
  });

  return createResult.count > 0;
}

/**
 * FunnelEmail (새 독립 모델) 트리거 — 그룹의 funnelEmailId → ScheduledEmailMessage 생성
 * GroupEmailFunnel과 달리 GroupEmailConfig 없이 발송자 이메일을 직접 지정.
 */
export async function triggerFunnelEmail(
  opts: EmailTriggerOptions
): Promise<boolean> {
  const { contactId, groupId, organizationId, reEntryPolicy } = opts;
  const isReset = typeof reEntryPolicy === "string" && reEntryPolicy.includes("RESET");

  // 1. 그룹의 funnelEmailId 조회
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId },
    select: { funnelEmailId: true, name: true },
  });

  if (!group?.funnelEmailId) return false;

  // 2. FunnelEmail + 메시지 조회
  const funnelEmail = await prisma.funnelEmail.findFirst({
    where: { id: group.funnelEmailId, organizationId, isActive: true },
    select: {
      id: true,
      title: true,
      sendHour: true,
      sendMinute: true,
      createdByUserId: true,
      messages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          daysAfter: true,
          subject: true,
          bodyHtml: true,
        },
      },
    },
  });

  if (!funnelEmail || funnelEmail.messages.length === 0) {
    return false;
  }

  // 3. Contact 조회 + 이메일/수신거부 체크
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { id: true, name: true, email: true, phone: true, optOutAt: true },
  });

  if (!contact || !contact.email || contact.optOutAt) {
    return false;
  }

  // 4. 멱등성 체크 / RESET 처리
  const existing = await prisma.scheduledEmailMessage.findMany({
    where: { organizationId, contactId, groupId, status: "PENDING" },
    select: { id: true },
  });

  if (existing.length > 0) {
    if (isReset) {
      await prisma.scheduledEmailMessage.updateMany({
        where: { id: { in: existing.map((r) => r.id) }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    } else {
      return false;
    }
  }

  // 5. 발송 기준일 및 변수
  const nowUtc = new Date();
  const anchor = opts.anchorDate ?? nowUtc;
  const kstAnchorDayjs = dayjs(anchor).tz(KST_TZ);

  const variables = {
    name: contact.name ?? "",
    email: contact.email,
    phone: contact.phone ?? "",
    groupName: group.name ?? "",
  };

  // 6. daysAfter → scheduledAt 변환
  const recordsToCreate = funnelEmail.messages.map((msg) => {
    let scheduledAt: Date;

    if (msg.daysAfter === 0) {
      scheduledAt = new Date(nowUtc.getTime() + 1_000);
    } else {
      const kstTarget = kstAnchorDayjs
        .add(msg.daysAfter, "day")
        .hour(funnelEmail.sendHour)
        .minute(funnelEmail.sendMinute)
        .second(0)
        .millisecond(0);
      scheduledAt = kstTarget.toDate();
      if (scheduledAt <= nowUtc) {
        scheduledAt = kstTarget.add(1, "day").toDate();
      }
    }

    return {
      organizationId,
      contactId,
      groupId,
      day: msg.daysAfter,
      subject: msg.subject,
      htmlContent: msg.bodyHtml,
      variables: variables as Record<string, string>,
      status: "PENDING" as const,
      scheduledAt,
      provider: "SMTP",
      senderUserId: funnelEmail.createdByUserId,
    };
  });

  const result = await prisma.scheduledEmailMessage.createMany({
    data: recordsToCreate,
    skipDuplicates: true,
  });

  logger.log("[FunnelEmailTrigger] 자동이메일 스케줄 생성", {
    contactId,
    groupId,
    funnelEmailId: funnelEmail.id,
    inserted: result.count,
  });

  return result.count > 0;
}
