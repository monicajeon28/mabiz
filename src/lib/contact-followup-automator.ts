import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Grant Cardone 5-12 Touch Rule:
 * 80% of sales happen after 5-12 touches (calls, emails, SMS, etc.)
 * Most sales people give up after 1-2 touches
 */

export interface FollowupSequence {
  contactId: string;
  sequenceType: "INITIAL_INTEREST" | "OBJECTION_RESPONSE" | "REACTIVATION";
  totalTouches: number; // 5-12
  completedTouches: number;
  currentStep: number;
  nextTouchAt: string;
  touches: Array<{
    day: number;
    channel: "CALL" | "SMS" | "EMAIL" | "FACEBOOK_MESSAGE" | "WHATSAPP";
    status: "PENDING" | "SENT" | "COMPLETED";
    template: string;
    sentAt?: string;
    responseReceived?: boolean;
  }>;
}

const INITIAL_INTEREST_SEQUENCE: FollowupSequence["touches"] = [
  {
    day: 0,
    channel: "SMS",
    status: "PENDING",
    template:
      "안녕하세요 [이름]님! [상품] 관심 가져주셔서 감사합니다. 질문이 있으시면 언제든 연락 주세요. 📞",
  },
  {
    day: 1,
    channel: "CALL",
    status: "PENDING",
    template: "직접 전화로 관심사 확인 및 혜택 설명",
  },
  {
    day: 2,
    channel: "EMAIL",
    status: "PENDING",
    template:
      "<h2>[이름]님을 위한 맞춤 제안</h2><p>어제 통화에서 나눈 내용을 토대로 최적의 옵션을 정리했습니다.</p><p>[PERSONALIZED_OFFER]</p>",
  },
  {
    day: 4,
    channel: "SMS",
    status: "PENDING",
    template: "아직 결정 못 하셨나요? 혜택이 제한적입니다. 오늘 결정하시면 추가 10% 할인을 드립니다!",
  },
  {
    day: 6,
    channel: "FACEBOOK_MESSAGE",
    status: "PENDING",
    template: "SNS를 통한 따뜻한 팔로업 메시지",
  },
  {
    day: 8,
    channel: "EMAIL",
    status: "PENDING",
    template:
      "사례 연구: [이름]님과 비슷한 고객이 얻은 결과 (여행 만족도 98%)",
  },
  {
    day: 10,
    channel: "CALL",
    status: "PENDING",
    template: "최종 확인 전화 + 결제 방법 안내",
  },
  {
    day: 12,
    channel: "SMS",
    status: "PENDING",
    template: "⏰ 한 번의 결정이 인생을 바꿉니다. 지금이 기회입니다!",
  },
  {
    day: 14,
    channel: "EMAIL",
    status: "PENDING",
    template:
      "거절했다면? 다시 생각해주세요. 다른 고객들은 이 가격으로 평생 후회하고 있습니다.",
  },
  {
    day: 16,
    channel: "WHATSAPP",
    status: "PENDING",
    template:
      "마지막 기회: 내일 마감입니다. 예약 링크 [BOOKING_LINK] 혹은 전화주세요 [PHONE]",
  },
  {
    day: 20,
    channel: "CALL",
    status: "PENDING",
    template: "최종 확인 콜: 선택 결과 어떻게 될지 명확히 해드립니다",
  },
  {
    day: 30,
    channel: "EMAIL",
    status: "PENDING",
    template:
      "구매 거절 관심군으로 분류. 6개월 후 재접근 예정. (거절한 고객의 80% 6개월 후 구매)",
  },
];

const OBJECTION_RESPONSE_SEQUENCE: FollowupSequence["touches"] = [
  {
    day: 0,
    channel: "SMS",
    status: "PENDING",
    template: "가격 고민이신가요? [특별제안] 이 기회는 오늘까지입니다.",
  },
  {
    day: 1,
    channel: "CALL",
    status: "PENDING",
    template:
      "이의 대응 전문 콜: 구체적인 금액 협상 및 유연한 결제 옵션 제시",
  },
  {
    day: 2,
    channel: "EMAIL",
    status: "PENDING",
    template: "가격 뜯어보기: 일일 단가 & 월간 분할 & 총 비용 vs 가치 비교",
  },
  {
    day: 4,
    channel: "SMS",
    status: "PENDING",
    template:
      "결정 신호: '지금 예약하면 __%할인' vs '내일은 표준가격' 명확한 마감시간 제시",
  },
  {
    day: 7,
    channel: "EMAIL",
    status: "PENDING",
    template: "사회증명: '같은 우려를 가진 100명이 이미 예약했습니다'",
  },
];

const REACTIVATION_SEQUENCE: FollowupSequence["touches"] = [
  {
    day: 0,
    channel: "SMS",
    status: "PENDING",
    template: "[이름]님, 한동안 연락이 없었네요. 안녕하세요? 😊",
  },
  {
    day: 2,
    channel: "CALL",
    status: "PENDING",
    template: "관심 확인 및 새로운 여행 정보 공유",
  },
  {
    day: 5,
    channel: "EMAIL",
    status: "PENDING",
    template: "[이름]님을 위한 새로운 여행 추천 (기존 관심사 기반)",
  },
  {
    day: 8,
    channel: "SMS",
    status: "PENDING",
    template: "특별 복귀 할인: 기존 고객 에게만 20% 할인",
  },
  {
    day: 12,
    channel: "CALL",
    status: "PENDING",
    template: "최종 복귀 제안 전화",
  },
];

export async function startFollowupSequence(
  contactId: string,
  sequenceType: FollowupSequence["sequenceType"]
): Promise<boolean> {
  try {
    let touchSequence: FollowupSequence["touches"] = [];

    switch (sequenceType) {
      case "INITIAL_INTEREST":
        touchSequence = INITIAL_INTEREST_SEQUENCE;
        break;
      case "OBJECTION_RESPONSE":
        touchSequence = OBJECTION_RESPONSE_SEQUENCE;
        break;
      case "REACTIVATION":
        touchSequence = REACTIVATION_SEQUENCE;
        break;
    }

    // Store sequence start in contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) return false;

    // TODO: Store followup sequence in a FollowupSequence model
    // For now, just log it
    logger.info("[Auto-Followup] Sequence started", {
      contactId,
      sequenceType,
      totalTouches: touchSequence.length,
      nextTouchAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    // TODO: Schedule first touch (day 0)
    // If day 0 is SMS, send immediately
    // If day 0 is CALL, schedule for next business hours

    return true;
  } catch (err) {
    logger.error("[Auto-Followup] Start sequence failed", { err, contactId });
    return false;
  }
}

export async function processScheduledFollowups(): Promise<number> {
  // TODO: Find all contacts with pending followup touches
  // TODO: For each touch that's due:
  //   - Send SMS/Email immediately
  //   - Schedule CALL for next business hours
  //   - Log completion
  // TODO: Update contact metadata with touch count

  logger.info("[Auto-Followup] Processing scheduled touches...");
  return 0;
}

export async function analyzeFollowupSuccess(
  contactId: string
): Promise<{
  totalTouches: number;
  responsiveAt: number; // which touch number they responded
  conversionRate: number;
  estimatedClosureDate: string;
}> {
  // TODO: Analyze historical data to predict when contact will close
  return {
    totalTouches: 0,
    responsiveAt: 0,
    conversionRate: 0,
    estimatedClosureDate: new Date().toISOString(),
  };
}
