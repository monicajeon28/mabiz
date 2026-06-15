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
}

/**
 * 그룹의 활성 이메일 퍼널을 트리거하여 ScheduledEmailMessage 레코드를 생성합니다.
 *
 * @returns true: 스케줄 생성 성공 | false: 이메일 퍼널 미설정 또는 조건 불충족
 */
export async function triggerGroupEmailFunnel(
  opts: EmailTriggerOptions
): Promise<boolean> {
  const { contactId, groupId, organizationId } = opts;

  // 1. GroupEmailFunnel 조회 (isActive: true)
  const emailFunnel = await prisma.groupEmailFunnel.findFirst({
    where: { groupId, organizationId, isActive: true },
    select: {
      id: true,
      title: true,
      emailConfigId: true,
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

  // 6. 멱등성 체크: 동일 contactId + groupId + PENDING 조합이 있으면 전체 스킵
  //    (재유입 RESET 정책이면 anchorDate가 갱신되지만 ScheduledEmailMessage에 channel이 없으므로
  //     groupId + contactId + PENDING 기준으로 단순 체크)
  const existingPending = await prisma.scheduledEmailMessage.findFirst({
    where: {
      organizationId,
      contactId,
      groupId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existingPending) {
    logger.log("[EmailFunnelTrigger] 중복 이메일 퍼널 스킵 (멱등성)", {
      contactId,
      groupId,
      existingId: existingPending.id,
    });
    return false;
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
      day:         msg.day,
      subject:     msg.subject,   // {{name}} 등 동적변수 원본 그대로 저장
      htmlContent: msg.bodyHtml,  // Cron 발송 시 치환
      variables:   variables as Record<string, string>,
      status:      "PENDING" as const,
      scheduledAt,
      provider:    emailConfig.emailProvider,
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
