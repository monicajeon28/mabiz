import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface RetentionSequenceTemplate {
  sequenceName: string;
  trigger: "NO_SALES_30D" | "REVENUE_DECLINE" | "QUALITY_DECLINE" | "MANUAL";
  steps: Array<{
    day: number;
    channel: "SMS" | "EMAIL" | "CALL";
    template: string;
    subject?: string;
  }>;
}

const RETENTION_SEQUENCES: Record<string, RetentionSequenceTemplate> = {
  REACTIVATION: {
    sequenceName: "파트너 재활성화 시퀀스",
    trigger: "NO_SALES_30D",
    steps: [
      {
        day: 0,
        channel: "SMS",
        template:
          "안녕하세요 [파트너명]님! 최근 판매 현황을 확인하고 싶습니다. 편한 시간에 전화 연락 가능하신가요? 특별 마케팅 지원을 제안하고 싶습니다.",
      },
      {
        day: 1,
        channel: "EMAIL",
        subject: "판매 부진 극복을 위한 [마비즈] 특별 지원 안내",
        template:
          "<h2>[파트너명]님의 판매 성공을 위해</h2><p>최근 한 달간 판매가 없으신 것으로 보여, 특별 지원 패키지를 준비했습니다.</p><ul><li>📊 시장 분석 자료 제공</li><li>🎯 타겟 고객 명단 (5,000명+)</li><li>💡 판매 스크립트 + 대화 전략</li><li>🎁 초기 구매 고객 수수료 +5% 추가 보너스</li></ul><p><strong>이번 주 중에 함께 전략을 수립해보겠습니다.</strong></p>",
      },
      {
        day: 3,
        channel: "CALL",
        template:
          "파트너 매니저가 전화드려서 현황을 파악하고 맞춤형 지원 계획을 세웁니다. (기대효과: 판매 재개)",
      },
      {
        day: 7,
        channel: "SMS",
        template:
          "[파트너명]님께 약속한 특별 지원이 준비됐습니다! 📥 내일 오후 3시 화상 미팅으로 함께 판매 전략을 세워보겠습니다. 참석 여부를 이 메시지로 회신해주세요.",
      },
      {
        day: 14,
        channel: "EMAIL",
        subject: "[긴급] 파트너 이탈 방지 - 최종 제안",
        template:
          "<h2>이번 주가 마지막 기회입니다</h2><p>우리는 [파트너명]님의 성공을 원합니다.</p><p><strong>한 번의 전화로 시작하세요:</strong></p><p>📞 매니저 직통: [MANAGER_PHONE]</p><p>혹은 아래 링크로 일정 예약:</p><p>[BOOKING_LINK]</p><p>함께하면 성공합니다! 💪</p>",
      },
    ],
  },

  REVENUE_RECOVERY: {
    sequenceName: "수익 회복 시퀀스",
    trigger: "REVENUE_DECLINE",
    steps: [
      {
        day: 0,
        channel: "SMS",
        template:
          "[파트너명]님! 지난달 대비 매출이 감소했습니다. 문제가 있으신가요? 함께 극복해보겠습니다. 편한 시간에 전화드리겠습니다.",
      },
      {
        day: 1,
        channel: "EMAIL",
        subject: "매출 증대를 위한 [마비즈] 맞춤형 전략",
        template:
          "<h2>📈 매출 회복 패키지</h2><p>지난달 대비 매출 감소 원인 분석 및 해결방안:</p><ul><li>🔍 마케팅 채널 분석 (어디에서 고객이 나오고 있는가?)</li><li>📱 SNS/광고 최적화 지원</li><li>💬 고객 응대 스크립트 개선</li><li>🎁 임시 수수료 인상 (20% → 25%, 2개월)</li></ul><p>이번 주 중 분석 결과를 공유하겠습니다.</p>",
      },
      {
        day: 3,
        channel: "CALL",
        template: "전략 회의 및 지원 계획 수립 콜",
      },
      {
        day: 7,
        channel: "SMS",
        template:
          "[파트너명]님! 분석 자료 준비됐습니다. 📊 내일 오전 10시 화상 미팅으로 함께 실행 계획을 세워보겠습니다. Y/N으로 회신주세요.",
      },
    ],
  },

  QUALITY_IMPROVEMENT: {
    sequenceName: "리드 품질 개선 시퀀스",
    trigger: "QUALITY_DECLINE",
    steps: [
      {
        day: 0,
        channel: "SMS",
        template:
          "[파트너명]님! 최근 리드 확인율이 낮아져 고민됩니다. 리드 기준을 함께 다시 확인해볼까요?",
      },
      {
        day: 1,
        channel: "EMAIL",
        subject: "리드 품질 기준 강화 교육",
        template:
          "<h2>🎯 좋은 리드의 기준</h2><p>우리가 함께 확인할 체크리스트:</p><ul><li>✅ 고객의 여행 예산 확인됐는가? (최소 $2,000)</li><li>✅ 출발 일정이 3개월 이내인가?</li><li>✅ 가족/동반자 동의는 충분한가?</li><li>✅ 의료 이력(배멀미, 고혈압 등) 확인됐는가?</li></ul><p><strong>이 4가지를 모두 확인한 리드만 제출해주세요.</strong></p><p>다음 주 교육 세션: [ZOOM_LINK]</p>",
      },
      {
        day: 3,
        channel: "CALL",
        template: "리드 품질 기준 교육 세션 (1:1 코칭)",
      },
      {
        day: 7,
        channel: "SMS",
        template:
          "개선된 리드를 5개 제출해주시면 각 리드당 추가 보너스 20,000원을 드리겠습니다! 이번 주에 시작해보세요. 💪",
      },
    ],
  },
};

export async function startRetentionSequence(
  partnerId: string,
  triggerType: string
): Promise<{ success: boolean; sequenceName?: string; nextStepAt?: string }> {
  try {
    const template = Object.values(RETENTION_SEQUENCES).find(
      (s) => s.trigger === triggerType
    );

    if (!template) {
      logger.warn("[Partner Retention] Unknown trigger type", { triggerType });
      return { success: false };
    }

    // First step: Send immediately
    const firstStep = template.steps[0];
    if (firstStep.channel === "SMS") {
      // TODO: Send SMS via Aligo
      logger.log("[Partner Retention] SMS scheduled", {
        partnerId,
        template: firstStep.template,
      });
    } else if (firstStep.channel === "EMAIL") {
      // TODO: Send email via SendGrid
      logger.log("[Partner Retention] Email scheduled", {
        partnerId,
        subject: firstStep.subject,
      });
    }

    // Schedule remaining steps
    const nextStep = template.steps[1];
    const nextStepDate = new Date(Date.now() + nextStep.day * 24 * 60 * 60 * 1000);

    // TODO: Store retention sequence progress in DB for tracking

    return {
      success: true,
      sequenceName: template.sequenceName,
      nextStepAt: nextStepDate.toISOString(),
    };
  } catch (err) {
    logger.error("[Partner Retention] Failed to start sequence", { err });
    return { success: false };
  }
}

export async function processRetentionScheduledSteps(): Promise<number> {
  // TODO: Check for any scheduled steps that are due today
  // TODO: Send SMS/Email/Schedule calls
  // TODO: Log completion
  return 0;
}
