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

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { validateSenderPhone, checkFunnelSmsIdempotency } from "@/lib/funnel-sms-helpers";
import {
  renderSmsTemplate,
  getContactVariables,
  getProductVariables,
  mergeVariables,
} from "@/lib/sms-variables";

// dayjs 플러그인 활성화 (KST 타임존 지원)
dayjs.extend(utc);
dayjs.extend(timezone);

interface TriggerOptions {
  contactId:      string;
  groupId:        string;
  organizationId: string;
  /**
   * 선택사항: 특정 FunnelSms만 발송.
   * 없으면 그룹의 funnelSmsIds[] (다중) → funnelSmsId (레거시 단일) 순으로 폴백.
   */
  funnelSmsId?:   string;
  /**
   * 선택사항: 회차(daysAfter) 계산 기준일.
   * 그룹 입장일(ContactGroupMember.addedAt)을 넘기면 입장일 기준으로 1일차/2일차가 계산된다.
   * 없으면 현재 시각을 기준으로 한다.
   */
  anchorDate?:    Date;
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

  // 4. 회차 기준일 (anchorDate=그룹 입장일 우선, 없으면 현재 시각)을 KST 자정으로 산출.
  //    nowUtc는 과거시각 보정(아래) 비교용으로 별도 유지한다.
  const nowUtc = new Date();
  const anchor = opts.anchorDate ?? nowUtc;
  // 유입 에피소드 식별키: addedAt(=anchor) epoch ms.
  // 같은 유입 → 같은 epoch → channel 동일 → 중복 차단.
  // 재유입(RESET 정책)으로 addedAt이 now로 갱신되면 epoch가 달라져 새 시퀀스 허용(0일차부터 재시작).
  const anchorEpoch = anchor.getTime();

  // [P0-3] KST 타임존 안전 계산: dayjs + timezone 플러그인 사용
  // 문제: Date.UTC() + UTC offset 수동 계산 → 자정 경계에서 버그 가능
  // 해결: dayjs.tz()로 표준 타임존 라이브러리 활용
  const kstAnchorDayjs = dayjs(anchor).tz("Asia/Seoul");
  const kstYear  = kstAnchorDayjs.year();
  const kstMonth = kstAnchorDayjs.month();  // 0-indexed (dayjs month도 0-based)
  const kstDay   = kstAnchorDayjs.date();

  // 5. 각 FunnelSms마다 스케줄 생성 (개별 실패 격리)
  let successCount = 0;
  for (const funnelSmsId of funnelSmsIds) {
    try {
      // 5-1. 멱등성 체크: PENDING/SENDING/SENT 상태 스케줄이 이미 있으면 스킵
      // (FAILED는 재시도 허용 → 차단하지 않음)
      // 중복 발송 경로: 랜딩 중복신청, 그룹이동 레이스, Webhook 재전송, 재트리거 API
      const idempotency = await checkFunnelSmsIdempotency(organizationId, contactId, funnelSmsId, anchorEpoch);
      if (idempotency.isDuplicate) {
        logger.log("[FunnelSmsTrigger] 중복 퍼널문자 차단 (멱등성)", {
          contactId,
          funnelSmsId,
          existingId: idempotency.existingId,
          existingStatus: idempotency.existingStatus,
        });
        continue;
      }

      // [P0-1] 재신청 시 기존 Day 1-3 SMS 캔슬 로직
      // 재입장(addedAt 갱신, RESET 정책) 시 이전 유입 에피소드의 PENDING SMS는 취소
      // 최초 신청(anchorEpoch 처음) vs 재신청(anchorEpoch 변경) 구분:
      // 같은 group + contact 조합에 다른 epoch 기존 스케줄이 있으면 → 모두 CANCELLED 처리
      const previousSchedules = await prisma.scheduledSms.findMany({
        where: {
          organizationId,
          contactId,
          funnelSmsId,
          status: "PENDING",
          // 현재 유입 에피소드(anchorEpoch)의 것이 아닌 기존 스케줄들
          NOT: {
            channel: {
              endsWith: `:${anchorEpoch}`,
            },
          },
        },
        select: { id: true },
      });

      if (previousSchedules.length > 0) {
        // 이전 에피소드 스케줄을 모두 CANCELLED 처리
        await prisma.scheduledSms.updateMany({
          where: {
            id: { in: previousSchedules.map((s) => s.id) },
          },
          data: { status: "CANCELLED" as const },
        });
        logger.log("[FunnelSmsTrigger] 재신청 시 기존 Day 1-3 SMS 취소", {
          contactId,
          funnelSmsId,
          cancelledCount: previousSchedules.length,
          newAnchorEpoch: anchorEpoch,
        });
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
          createdByUserId: true,
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

      const sendHour   = funnelSms.sendHour;
      const sendMinute = funnelSms.sendMinute;

      // 5-2-b. [발신번호] 실제 발송 발신번호의 SSoT는 BatchSender의 작성자 개인 알리고
      //   config.sender(개인>조직>env)이다. 따라서 여기서 검증 결과로 퍼널 전체를
      //   '스킵'하면 정당한 발송이 거짓음성으로 누락된다 → continue 스킵 제거.
      //   senderPhone 컬럼 저장은 무해(미래 호환용 데드데이터)하므로 폴백 결과를 그대로 남긴다.
      const phoneValidation = await validateSenderPhone(organizationId, funnelSms.senderPhone);
      if (!phoneValidation.valid) {
        logger.warn("[FunnelSmsTrigger] 미검증 발신번호(참고 로그) — 발송은 BatchSender config.sender가 SSoT", {
          organizationId,
          funnelSmsId,
          attempted: funnelSms.senderPhone,
          fallback: phoneValidation.fallbackPhone,
        });
      }
      // 폴백 결과(undefined 가능)를 senderPhone 컬럼에 저장. BatchSender가 무시하므로 발송엔 영향 없음.
      const resolvedSenderPhone = phoneValidation.fallbackPhone ?? funnelSms.senderPhone ?? undefined;

      // 5-3. 각 FunnelSmsMessage → ScheduledSms INSERT (단일 createMany)
      const data = funnelSms.messages.map((msg) => {
        // Day 0 (즉시발송): 현재 시각에 즉시 발송
        // Day 1+: KST 벽시계 시각(자정 기준 입장일 + daysAfter, sendHour:sendMinute) 예약 발송
        let scheduledAt: Date;

        if (msg.daysAfter === 0) {
          // 즉시발송: 현재 시각으로 설정 (Cron이 PENDING 상태를 즉시 감지하여 발송)
          scheduledAt = new Date(nowUtc.getTime() + 1000); // 1초 뒤 (안전마진)
        } else {
          // [P0-3] 예약발송: dayjs + timezone으로 안전한 KST 계산
          // sendHour < 9 (KST 0~8시)에서도 자정 경계 버그 방지
          const targetDay = kstDay + msg.daysAfter;
          const kstTargetDayjs = dayjs()
            .tz("Asia/Seoul")
            .year(kstYear)
            .month(kstMonth)
            .date(targetDay)
            .hour(sendHour)
            .minute(sendMinute)
            .second(0)
            .millisecond(0);

          scheduledAt = kstTargetDayjs.toDate();

          // 과거시각 보정 — 설정시각이 현재시각보다 이른 경우 다음 날로 미룸
          if (scheduledAt <= nowUtc) {
            const kstNextDayjs = kstTargetDayjs.add(1, "day");
            scheduledAt = kstNextDayjs.toDate();
          }
        }
        // 유입 에피소드(anchorEpoch)를 포함해 재유입 시 새 시퀀스가 생성되도록 한다.
        // 같은 유입은 동일 channel → 부분 UNIQUE 인덱스로 race 중복 차단.
        const channel = `FUNNEL_SMS:${funnelSmsId}:${msg.id}:${anchorEpoch}`;

        // [Phase A] 동적 변수 시스템 적용
        // Contact 기본 정보에서 변수 추출 (productName을 destination으로 사용)
        const contactVars = getContactVariables(contact);
        // 커스텀 변수 (managerPhone, remainingSeats 등 optional)
        const customVars = {
          managerPhone: "1800-CRUISE", // 기본값
          remainingSeats: "10", // 기본값
        };
        const allVars = mergeVariables(contactVars, customVars);

        // 템플릿의 {{변수}}를 실제 값으로 치환
        const message = renderSmsTemplate(msg.content, allVars);

        logger.log("[FunnelSmsTrigger] SMS 메시지 동적 변수 처리", {
          funnelSmsId,
          messageId: msg.id,
          daysAfter: msg.daysAfter,
          contactName: contact.name,
          variablesUsed: Object.keys(allVars).length,
        });

        return {
          organizationId,
          contactId,
          groupId,
          message,
          scheduledAt,
          status: "PENDING" as const,
          channel,
          // [SSoT] 회차 추적용 컬럼 — 누가 언제 들어와 몇 회차 나갔는지 사람별 추적
          funnelSmsId,
          funnelSmsMessageId: msg.id,
          round: msg.daysAfter,
          // [데드데이터/미래호환] 발송 발신번호 SSoT는 BatchSender의 작성자 config.sender이며 이 값은 무시됨
          senderPhone: resolvedSenderPhone,
          // 퍼널 소유자 계정으로 발송 → BatchSender가 작성자별 개인 알리고(개인>조직>env) 해석
          createdByUserId: funnelSms.createdByUserId ?? null,
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
