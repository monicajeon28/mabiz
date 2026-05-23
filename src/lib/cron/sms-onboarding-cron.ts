/**
 * SMS 온보딩 마법사 Cron Job
 *
 * 목적:
 * - 매일 09:00 KST에 미분류 고객 500명에게 Day 0 SMS 발송
 * - 기존 응답 고객에게 Day 1-3 SMS 순차 발송
 * - NLP 파싱 + 자동 세그먼트 분류
 *
 * 실행 방식:
 * - Vercel Cron (vercel.json) 또는 외부 스케줄러 (Zapier, AWS EventBridge)
 * - GET /api/cron/onboarding-sms
 */

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/aligo";
import { normalizePhone } from "@/lib/phone-normalize";

export interface OnboardingSmsScheduleResult {
  timestamp: string;
  totalProcessed: number;
  day0Sent: number;
  day1Sent: number;
  day2Sent: number;
  day3Sent: number;
  totalFailed: number;
  duration: string;
  stats: {
    unclassifiedCount: number;
    smsOptedInCount: number;
    sentToday: number;
  };
}

interface OnboardingStage {
  contactId: string;
  currentStage: 0 | 1 | 2 | 3 | 4; // 0=Day0, 1=Day1, 2=Day2, 3=Day3, 4=Complete
  lastSentAt?: Date;
  lastSentDay?: number;
  daysElapsedSinceLastSms?: number;
}

/**
 * 고객의 현재 온보딩 단계 조회
 */
async function getOnboardingStage(
  contactId: string
): Promise<OnboardingStage> {
  // ContactLensSequence에서 onboarding 레코드 조회
  const sequence = await prisma.contactLensSequence.findFirst({
    where: {
      contactId,
      sequenceType: "ONBOARDING",
    },
    orderBy: { startedAt: "desc" },
    select: {
      day0Sent: true,
      day0SentAt: true,
      day1Sent: true,
      day1SentAt: true,
      day2Sent: true,
      day2SentAt: true,
      day3Sent: true,
      day3SentAt: true,
      completedAt: true,
    },
  });

  // 단계 결정 로직
  if (!sequence) {
    return {
      contactId,
      currentStage: 0,
    };
  }

  if (sequence.completedAt) {
    return {
      contactId,
      currentStage: 4,
    };
  }

  if (sequence.day3Sent) {
    return {
      contactId,
      currentStage: 3,
      lastSentAt: sequence.day3SentAt || new Date(),
      lastSentDay: 3,
    };
  }

  if (sequence.day2Sent) {
    return {
      contactId,
      currentStage: 2,
      lastSentAt: sequence.day2SentAt || new Date(),
      lastSentDay: 2,
      daysElapsedSinceLastSms: getDaysElapsed(sequence.day2SentAt),
    };
  }

  if (sequence.day1Sent) {
    return {
      contactId,
      currentStage: 1,
      lastSentAt: sequence.day1SentAt || new Date(),
      lastSentDay: 1,
      daysElapsedSinceLastSms: getDaysElapsed(sequence.day1SentAt),
    };
  }

  if (sequence.day0Sent) {
    return {
      contactId,
      currentStage: 0,
      lastSentAt: sequence.day0SentAt || new Date(),
      lastSentDay: 0,
      daysElapsedSinceLastSms: getDaysElapsed(sequence.day0SentAt),
    };
  }

  return {
    contactId,
    currentStage: 0,
  };
}

/**
 * 며칠이 경과했는지 계산
 */
function getDaysElapsed(date?: Date | null): number {
  if (!date) return 999;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 미분류 고객 500명 조회
 */
async function getUnclassifiedContacts(limit: number = 500) {
  return await prisma.contact.findMany({
    where: {
      autoSegment: "unclassified",
      deletedAt: null,
    },
    take: limit,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      phone: true,
      name: true,
      organizationId: true,
    },
  });
}

/**
 * SMS 템플릿 조회
 */
async function getSmsTemplate(
  organizationId: string,
  templateKey: string
): Promise<string | null> {
  const template = await prisma.smsTemplate.findFirst({
    where: {
      organizationId,
      title: templateKey,
    },
    select: { content: true },
  });
  return template?.content || null;
}

/**
 * SMS 발송 및 상태 기록
 */
async function sendOnboardingSms(
  contactId: string,
  phone: string,
  organizationId: string,
  day: 0 | 1 | 2 | 3,
  smsConfig: { key: string; userId: string; sender: string },
  messageTemplate: string
) {
  const normalizedPhone = normalizePhone(phone);

  const result = await sendSms({
    config: smsConfig,
    receiver: normalizedPhone,
    msg: messageTemplate,
    msgType: "SMS",
    organizationId,
    contactId,
  });

  if (result.result_code !== 0) {
    logger.error(`[OnboardingCron] SMS 발송 실패 (Day ${day})`, {
      contactId,
      phone: normalizedPhone.slice(0, 4) + "***",
      resultCode: result.result_code,
      message: result.message,
    });
    return false;
  }

  // ContactLensSequence 상태 업데이트
  const dayKey = `day${day}Sent` as const;
  const dayAtKey = `day${day}SentAt` as const;

  const sequence = await prisma.contactLensSequence.findFirst({
    where: {
      contactId,
      sequenceType: "ONBOARDING",
    },
  });

  if (!sequence) {
    // 신규 시퀀스 생성
    const classification = await prisma.contactLensClassification.findFirst({
      where: {
        contactId,
        lensType: "OB", // Onboarding
      },
      select: { id: true },
    });

    if (classification) {
      await prisma.contactLensSequence.create({
        data: {
          contactId,
          organizationId,
          classificationId: classification.id,
          sequenceType: "ONBOARDING",
          lensType: "OB",
          [dayKey]: true,
          [dayAtKey]: new Date(),
          status: "PENDING",
        },
      });
    } else {
      // classification 없으면 새로 생성
      const newClass = await prisma.contactLensClassification.create({
        data: {
          contactId,
          organizationId,
          lensType: "OB",
          status: "ACTIVE",
        },
      });

      await prisma.contactLensSequence.create({
        data: {
          contactId,
          organizationId,
          classificationId: newClass.id,
          sequenceType: "ONBOARDING",
          lensType: "OB",
          [dayKey]: true,
          [dayAtKey]: new Date(),
          status: "PENDING",
        },
      });
    }
  } else {
    // 기존 시퀀스 업데이트
    await prisma.contactLensSequence.update({
      where: { id: sequence.id },
      data: {
        [dayKey]: true,
        [dayAtKey]: new Date(),
      },
    });
  }

  logger.info(`[OnboardingCron] SMS 발송 성공 (Day ${day})`, {
    contactId,
    phone: normalizedPhone.slice(0, 4) + "***",
  });

  return true;
}

/**
 * 메인 Cron 실행 함수
 */
export async function scheduleOnboardingSms(): Promise<OnboardingSmsScheduleResult> {
  const startTime = Date.now();

  let day0Sent = 0;
  let day1Sent = 0;
  let day2Sent = 0;
  let day3Sent = 0;
  let totalFailed = 0;

  try {
    logger.info("[OnboardingCron] 시작");

    // 1. 조직별 SMS Config 조회
    const orgs = await prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        smsConfig: {
          select: {
            aligoKey: true,
            aligoUserId: true,
            senderPhone: true,
          },
        },
      },
    });

    const orgConfigs = orgs
      .filter((org) => org.smsConfig)
      .reduce(
        (acc, org) => {
          acc[org.id] = {
            key: org.smsConfig!.aligoKey,
            userId: org.smsConfig!.aligoUserId,
            sender: org.smsConfig!.senderPhone,
          };
          return acc;
        },
        {} as Record<string, { key: string; userId: string; sender: string }>
      );

    // 2. 미분류 고객 500명 조회
    const contacts = await getUnclassifiedContacts(500);
    const unclassifiedCount = contacts.length;

    logger.info("[OnboardingCron] 미분류 고객 조회", {
      count: unclassifiedCount,
    });

    // 3. 고객별 현재 단계 확인 및 SMS 발송
    for (const contact of contacts) {
      const stage = await getOnboardingStage(contact.id);
      const smsConfig = orgConfigs[contact.organizationId];

      if (!smsConfig) {
        logger.warn(
          "[OnboardingCron] SMS Config 없음",
          {
            organizationId: contact.organizationId,
          }
        );
        totalFailed++;
        continue;
      }

      // Day 0: 초기 발송 (또는 재발송)
      if (stage.currentStage === 0) {
        const template =
          (await getSmsTemplate(
            contact.organizationId,
            "ONBOARDING_DAY0"
          )) || `안녕하세요, ${contact.name}님!\n결혼 상태가 어떻게 되세요?\n1) 미혼 2) 결혼 3) 그 외\n(숫자로 답변해주세요)`;

        const sent = await sendOnboardingSms(
          contact.id,
          contact.phone,
          contact.organizationId,
          0,
          smsConfig,
          template
        );

        if (sent) day0Sent++;
        else totalFailed++;
      }

      // Day 1: 24시간 이후 발송
      if (
        stage.currentStage === 0 &&
        stage.daysElapsedSinceLastSms &&
        stage.daysElapsedSinceLastSms >= 1
      ) {
        const template =
          (await getSmsTemplate(
            contact.organizationId,
            "ONBOARDING_DAY1"
          )) || `감사합니다!\n결혼하신 지 몇 년 되셨어요? 자녀분 계신가요?\n(예: 결혼 5년, 아이 2명 10살 8살)`;

        const sent = await sendOnboardingSms(
          contact.id,
          contact.phone,
          contact.organizationId,
          1,
          smsConfig,
          template
        );

        if (sent) day1Sent++;
        else totalFailed++;
      }

      // Day 2: 48시간 이후 발송
      if (
        stage.currentStage === 1 &&
        stage.daysElapsedSinceLastSms &&
        stage.daysElapsedSinceLastSms >= 1
      ) {
        const template =
          (await getSmsTemplate(
            contact.organizationId,
            "ONBOARDING_DAY2"
          )) || `정보 감사합니다!\n혹시 나이가 어떻게 되세요? (예: 45)`;

        const sent = await sendOnboardingSms(
          contact.id,
          contact.phone,
          contact.organizationId,
          2,
          smsConfig,
          template
        );

        if (sent) day2Sent++;
        else totalFailed++;
      }

      // Day 3: 72시간 이후 발송
      if (
        stage.currentStage === 2 &&
        stage.daysElapsedSinceLastSms &&
        stage.daysElapsedSinceLastSms >= 1
      ) {
        const template =
          (await getSmsTemplate(
            contact.organizationId,
            "ONBOARDING_DAY3"
          )) || `마지막 질문입니다!\n크루즈 여행의 목적이 뭔가요?\n1) 휴식/힐링 2) 모험/새로운 경험 3) 가족/추억 4) 문화/역사`;

        const sent = await sendOnboardingSms(
          contact.id,
          contact.phone,
          contact.organizationId,
          3,
          smsConfig,
          template
        );

        if (sent) day3Sent++;
        else totalFailed++;
      }
    }

    const duration = `${Math.floor(Date.now() - startTime)}ms`;
    const result: OnboardingSmsScheduleResult = {
      timestamp: new Date().toISOString(),
      totalProcessed: contacts.length,
      day0Sent,
      day1Sent,
      day2Sent,
      day3Sent,
      totalFailed,
      duration,
      stats: {
        unclassifiedCount,
        smsOptedInCount: contacts.length,
        sentToday: day0Sent + day1Sent + day2Sent + day3Sent,
      },
    };

    logger.info("[OnboardingCron] 완료", result);
    return result;
  } catch (error) {
    logger.error("[OnboardingCron] 오류", { error });
    throw error;
  }
}
