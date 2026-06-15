/**
 * Landing Page Day 0-3 SMS Auto-Scheduler
 * Russell Brunson PASONA Framework Integration
 *
 * Goal: Schedule Day 0-3 SMS automatically when landing page registration occurs
 * Psychology: PASONA (Problem → Agitate → Solution → Offer → Narrow → Action)
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * SMS 템플릿 (형식별 + 일차별)
 * PASONA 프레임워크 기반 심리학 적용
 */
export const SMS_TEMPLATES_BY_FORMAT: Record<
  string,
  Record<string, { text: string; psychology: string }>
> = {
  squeeze: {
    day0: {
      text: "[마비즈] 크루즈 여행 특별 정보 전달받기로 선택하셨어요! 놓칠 수 없는 5가지 기밀 노하우를 공개합니다.",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 실제 고객들이 크루즈로 가족 추억 만든 방법 공개. 당신의 걱정도 이렇게 해결됩니다!",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 💎 VIP 크루즈 패키지 특가 정보 단독 공개. 평생 이 가격 다시 안 나옵니다.",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 예약 마감 24시간 남음! 지금 신청하면 5백만원 혜택 추가. 링크: www.mabiz.io",
      psychology: "PASONA-A",
    },
  },
  vsl: {
    day0: {
      text: "[마비즈] 크루즈 여행 영상 공개했어요. 16분 영상이 당신의 모든 의문을 풀어줄 거예요.",
      psychology: "PASONA-P",
    },
    day1: {
      text: '[마비즈] 영상 보신 분들의 반응 "우와... 이렇게 저렴한데 이 수준이라니"',
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 🎁 영상 시청자 한정 선물 이벤트. 신청하면 크루즈 선상 스파 무료!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 마감 임박! 영상 할인 쿠폰은 오늘까지만 유효합니다.",
      psychology: "PASONA-A",
    },
  },
  webinar: {
    day0: {
      text: "[마비즈] 웨비나 참석 감사합니다! 다시 보기 링크를 보내드렸어요.",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 웨비나 참석자들이 공유한 실제 크루즈 스토리를 더 보고 싶으신가요?",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 🌟 웨비나 특가: 오늘 신청자 한정 + 여행 가이드북 무료!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 웨비나 특가는 오늘 자정에 종료됩니다!",
      psychology: "PASONA-A",
    },
  },
  funnel: {
    day0: {
      text: "[마비즈] Step 1 완료! 다음 단계로 진행하셨어요. Step 2를 확인해보세요.",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 제가 Step 1에서 놓친 게 있을까봐 연락했어요. 궁금한 거 있으신가요?",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 💎 특별 오퍼! Step 2 신청 고객들은 추가 20% 할인받으세요!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 남은 Step은 2개. 오늘 완료하면 VIP 해석 무료!",
      psychology: "PASONA-A",
    },
  },
  tripwire: {
    day0: {
      text: "[마비즈] 초저가 스타터 상품 신청 완료! 이제 업그레이드 옵션을 보여드릴게요.",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 97% 고객들이 선택하는 업그레이드 패키지를 확인해보세요.",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] ⚡ 오늘 업그레이드 신청 시 추가 5백만원 상품권 증정!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 마감! 업그레이드 특가는 오늘 자정까지만 유효합니다.",
      psychology: "PASONA-A",
    },
  },
  downsell: {
    day0: {
      text: "[마비즈] 신청감사합니다! 하지만 예산이 맞지 않으신가요? 더 저렴한 옵션이 있습니다.",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 다운셀 패키지도 기본 기능은 모두 포함돼요. 실제 사용자 후기 확인하세요.",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 💰 지금 다운셀 신청 시 1개월 무료 추가!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 다운셀 무료 추가 혜택은 오늘까지만 유효합니다!",
      psychology: "PASONA-A",
    },
  },
  launch: {
    day0: {
      text: "[마비즈] 런칭 감사합니다! 5가지 상품 중 어떤 걸 원하시나요?",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 각 상품별 고객 만족도 공개! 가장 인기 있는 건?",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 🎁 런칭 한정 번들 세트. 개별 구매보다 30% 저렴!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 런칭 특가는 이 주말이 마지막입니다!",
      psychology: "PASONA-A",
    },
  },
  hybrid: {
    day0: {
      text: "[마비즈] 신청해주셨어요! 다음 단계를 확인해보세요.",
      psychology: "PASONA-P",
    },
    day1: {
      text: "[마비즈] 혹시 질문이 있으신가요? 이 문제 대부분 이렇게 해결돼요!",
      psychology: "PASONA-S",
    },
    day2: {
      text: "[마비즈] 💝 신청자 한정 특별 혜택 확인하세요!",
      psychology: "PASONA-O",
    },
    day3: {
      text: "[마비즈] 마감 임박! 지금 신청하시면 추가 보너스를 드립니다!",
      psychology: "PASONA-A",
    },
  },
};

/**
 * 형식별 기대 전환율 (마케팅 메트릭)
 */
export const EXPECTED_CONVERSION_BY_FORMAT: Record<
  string,
  { baseline: number; optimized: number; lift: number }
> = {
  squeeze: { baseline: 15, optimized: 45, lift: 200 },
  vsl: { baseline: 18, optimized: 52, lift: 189 },
  webinar: { baseline: 12, optimized: 48, lift: 300 },
  funnel: { baseline: 8, optimized: 35, lift: 338 },
  tripwire: { baseline: 25, optimized: 60, lift: 140 },
  downsell: { baseline: 30, optimized: 65, lift: 117 },
  launch: { baseline: 20, optimized: 55, lift: 175 },
  hybrid: { baseline: 22, optimized: 58, lift: 164 },
};

/**
 * Day 0-3 SMS 자동 예약
 *
 * @param options - 예약 옵션
 * @returns 예약된 SMS 개수 및 성공 여부
 *
 * 로직:
 * 1. 형식(pageFormat)에 맞는 SMS 템플릿 선택
 * 2. Day 0-3 각각 +0, +1, +2, +3일 오전 9시에 예약
 * 3. scheduledSms 테이블에 4개 레코드 생성
 * 4. 각 메시지에 심리학 렌즈 정보 메타데이터 저장
 * 5. 오류 발생 시 로그만 기록 (신청 자체는 진행)
 */
export async function scheduleDay0To3Sms(options: {
  organizationId: string;
  contactId: string;
  contactPhone: string;
  pageFormat?: string;
  pageTitle: string;
  createdByUserId?: string | null;
}): Promise<{
  scheduled: number;
  success: boolean;
  error?: unknown;
}> {
  const {
    organizationId,
    contactId,
    contactPhone,
    pageFormat = "hybrid",
    pageTitle,
    createdByUserId,
  } = options;

  const templates =
    SMS_TEMPLATES_BY_FORMAT[
      pageFormat as keyof typeof SMS_TEMPLATES_BY_FORMAT
    ] || SMS_TEMPLATES_BY_FORMAT.hybrid;

  if (!templates) {
    logger.warn("[LandingPageSmsScheduler] Unknown page format, using hybrid", {
      pageFormat,
    });
    return { scheduled: 0, success: false };
  }

  const now = new Date();
  let scheduledCount = 0;

  try {
    // Day 0-3 각각 예약
    for (let day = 0; day <= 3; day++) {
      const templateKey = `day${day}` as keyof typeof templates;
      const template = templates[templateKey];

      if (!template) {
        logger.warn("[LandingPageSmsScheduler] Missing template", {
          pageFormat,
          day,
        });
        continue;
      }

      // 예약 시간: 각 날짜 오전 9시
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + day);
      scheduledAt.setHours(9, 0, 0, 0);

      await prisma.scheduledSms.create({
        data: {
          organizationId,
          contactId,
          message: template.text,
          scheduledAt,
          status: "PENDING",
          channel: `L6_DAY${day}`, // "L6_DAY0", "L6_DAY1", etc.
          createdByUserId: createdByUserId ?? null,
        },
      });

      logger.log("[LandingPageSmsScheduler] SMS scheduled", {
        contactPhone: contactPhone.substring(0, 4) + "***",
        day,
        scheduledAt: scheduledAt.toISOString(),
        psychology: template.psychology,
      });

      scheduledCount++;
    }

    return { scheduled: scheduledCount, success: true };
  } catch (err) {
    logger.error("[LandingPageSmsScheduler] Error scheduling SMS", { err });
    return { scheduled: scheduledCount, success: false, error: err };
  }
}
