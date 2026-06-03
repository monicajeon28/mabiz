import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ChurnPrediction {
  contactId: string;
  contactName: string;
  churnProbability: number; // 0-1 (0-100%)
  daysUntilChurn: number;
  signals: string[];
  recommendedAction: string;
}

export interface UpsellOpportunity {
  contactId: string;
  contactName: string;
  currentValue: number;
  upsellPotential: number; // 추가 매출 가능성
  opportunityType: string; // "UPGRADE_TIER" | "ADD_SERVICE" | "EXTEND_DURATION"
  confidence: number; // 0-1
  recommendedOffer: string;
}

export async function predictContactChurn(
  contactId: string
): Promise<ChurnPrediction | null> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        callLogs: { orderBy: { createdAt: "desc" }, take: 30 },
        memos: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!contact) return null;

    let churnScore = 0;
    const signals: string[] = [];

    // Signal 1: No contact in X days
    const lastContactDate = contact.lastContactedAt
      ? new Date(contact.lastContactedAt)
      : contact.createdAt;
    const daysSinceLastContact = Math.floor(
      (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastContact > 60) {
      churnScore += 25;
      signals.push("60일 이상 연락 없음");
    } else if (daysSinceLastContact > 30) {
      churnScore += 15;
      signals.push("30일 이상 연락 없음");
    } else if (daysSinceLastContact > 14) {
      churnScore += 5;
      signals.push("14일 이상 연락 없음");
    }

    // Signal 2: No memo/activity
    const recentActivityCount =
      contact.memos?.length || 0 + contact.callLogs?.length || 0;
    if (recentActivityCount === 0) {
      churnScore += 15;
      signals.push("활동 기록 없음");
    }

    // Signal 3: Unresolved objections (e.g., "가격 비싸다" tag)
    if (contact.tags?.includes("OBJECTION_UNRESOLVED")) {
      churnScore += 20;
      signals.push("해결되지 않은 이의 존재");
    }

    // Signal 4: Multiple contact attempts with no response
    const failedAttempts = contact.callLogs?.filter(
      (c) => c.content?.includes("미응") || c.content?.includes("미연락")
    ).length || 0;

    if (failedAttempts > 2) {
      churnScore += 15;
      signals.push(`${failedAttempts}회 이상 미응 기록`);
    }

    // Signal 5: Segment is LOW_PRIORITY
    if (contact.segment === "LOW_PRIORITY") {
      churnScore += 10;
      signals.push("저우선순위 세그먼트");
    }

    // Signal 6: Payment/Deposit overdue
    if (contact.tags?.includes("PAYMENT_OVERDUE")) {
      churnScore += 25;
      signals.push("결제 미달");
    }

    // Signal 7: Negative sentiment in recent memos
    const recentMemos = contact.memos?.slice(0, 5) || [];
    const negativeMemos = recentMemos.filter(
      (m) =>
        m.content?.includes("불만") ||
        m.content?.includes("거절") ||
        m.content?.includes("취소")
    ).length;

    if (negativeMemos > 0) {
      churnScore += 10 * negativeMemos;
      signals.push(`${negativeMemos}건의 부정적 피드백`);
    }

    // Calculate days until churn (based on signals)
    let daysUntilChurn = 90;
    if (signals.length >= 3) daysUntilChurn = 30;
    if (signals.length >= 5) daysUntilChurn = 14;
    if (churnScore >= 80) daysUntilChurn = 7;

    // Recommended action
    let recommendedAction = "주기적 팔로업";
    if (churnScore >= 80) {
      recommendedAction = "긴급: 매니저 직통 전화";
    } else if (churnScore >= 60) {
      recommendedAction = "우선 연락 + 인센티브 제안";
    } else if (churnScore >= 40) {
      recommendedAction = "정기 체크인 + 가치 재확인";
    }

    return {
      contactId,
      contactName: contact.name,
      churnProbability: Math.min(100, churnScore) / 100,
      daysUntilChurn,
      signals,
      recommendedAction,
    };
  } catch (err) {
    logger.error("[Churn Prediction]", { err, contactId });
    return null;
  }
}

export async function identifyUpsellOpportunities(
  contactId: string
): Promise<UpsellOpportunity | null> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        callLogs: { take: 50 },
      },
    });

    if (!contact) return null;

    // Baseline: estimate current customer value
    const currentValue = 2500000; // 250만원 (example)

    let opportunityType = "ADD_SERVICE";
    let confidence = 0.5;
    let recommendedOffer = "추가 서비스 패키지";

    // Signal: Family/companion mentioned → upsell to group discount
    if (
      contact.callLogs?.some((c) =>
        c.content?.includes("가족") || c.content?.includes("동반")
      )
    ) {
      opportunityType = "UPGRADE_TIER";
      confidence = 0.75;
      recommendedOffer =
        "그룹 할인 패키지 (가족/친구 함께 참여 시 10% 할인)";
    }

    // Signal: Multiple trips mentioned → upsell annual pass
    const tripMentions =
      contact.callLogs?.filter((c) =>
        c.content?.match(/크루즈|여행|기항/gi)
      ).length || 0;

    if (tripMentions > 3) {
      opportunityType = "EXTEND_DURATION";
      confidence = 0.8;
      recommendedOffer = "연간 구독 패키지 (분할 결제 가능)";
    }

    // Signal: Health concerns mentioned → upsell medical insurance
    if (
      contact.callLogs?.some((c) =>
        c.content?.match(/배멀미|고혈압|당뇨|건강/gi)
      )
    ) {
      opportunityType = "ADD_SERVICE";
      confidence = 0.6;
      recommendedOffer = "여행자 의료보험 추가 (+20만원)";
    }

    // Signal: Budget conscious → upsell payment plan
    if (
      contact.callLogs?.some((c) =>
        c.content?.includes("비싸다") || c.content?.includes("비용")
      )
    ) {
      opportunityType = "UPGRADE_TIER";
      confidence = 0.65;
      recommendedOffer = "12개월 분할 결제 (이자 0%, 수수료 무료)";
    }

    const upsellPotential = currentValue * (confidence * 0.3); // 30% potential upside

    return {
      contactId,
      contactName: contact.name,
      currentValue,
      upsellPotential,
      opportunityType,
      confidence,
      recommendedOffer,
    };
  } catch (err) {
    logger.error("[Upsell Prediction]", { err, contactId });
    return null;
  }
}

export async function predictAllChurns(
  organizationId: string
): Promise<ChurnPrediction[]> {
  // 단일 배치 쿼리로 모든 contact + 관련 데이터를 한 번에 조회
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    take: 1000,
    include: {
      callLogs: { orderBy: { createdAt: "desc" }, take: 30 },
      memos: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  const predictions: ChurnPrediction[] = [];

  for (const contact of contacts) {
    // contact 객체를 직접 사용해 DB 재조회 없이 churn 점수 계산
    let churnScore = 0;
    const signals: string[] = [];

    const lastContactDate = contact.lastContactedAt
      ? new Date(contact.lastContactedAt)
      : contact.createdAt;
    const daysSinceLastContact = Math.floor(
      (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastContact > 60) {
      churnScore += 25;
      signals.push("60일 이상 연락 없음");
    } else if (daysSinceLastContact > 30) {
      churnScore += 15;
      signals.push("30일 이상 연락 없음");
    } else if (daysSinceLastContact > 14) {
      churnScore += 5;
      signals.push("14일 이상 연락 없음");
    }

    const recentActivityCount =
      contact.memos?.length || 0 + contact.callLogs?.length || 0;
    if (recentActivityCount === 0) {
      churnScore += 15;
      signals.push("활동 기록 없음");
    }

    if (contact.tags?.includes("OBJECTION_UNRESOLVED")) {
      churnScore += 20;
      signals.push("해결되지 않은 이의 존재");
    }

    const failedAttempts =
      contact.callLogs?.filter(
        (c) => c.content?.includes("미응") || c.content?.includes("미연락")
      ).length || 0;
    if (failedAttempts > 2) {
      churnScore += 15;
      signals.push(`${failedAttempts}회 이상 미응 기록`);
    }

    if (contact.segment === "LOW_PRIORITY") {
      churnScore += 10;
      signals.push("저우선순위 세그먼트");
    }

    if (contact.tags?.includes("PAYMENT_OVERDUE")) {
      churnScore += 25;
      signals.push("결제 미달");
    }

    const recentMemos = contact.memos?.slice(0, 5) || [];
    const negativeMemos = recentMemos.filter(
      (m) =>
        m.content?.includes("불만") ||
        m.content?.includes("거절") ||
        m.content?.includes("취소")
    ).length;
    if (negativeMemos > 0) {
      churnScore += 10 * negativeMemos;
      signals.push(`${negativeMemos}건의 부정적 피드백`);
    }

    let daysUntilChurn = 90;
    if (signals.length >= 3) daysUntilChurn = 30;
    if (signals.length >= 5) daysUntilChurn = 14;
    if (churnScore >= 80) daysUntilChurn = 7;

    let recommendedAction = "주기적 팔로업";
    if (churnScore >= 80) {
      recommendedAction = "긴급: 매니저 직통 전화";
    } else if (churnScore >= 60) {
      recommendedAction = "우선 연락 + 인센티브 제안";
    } else if (churnScore >= 40) {
      recommendedAction = "정기 체크인 + 가치 재확인";
    }

    const churnProbability = Math.min(100, churnScore) / 100;
    if (churnProbability > 0.5) {
      predictions.push({
        contactId: contact.id,
        contactName: contact.name,
        churnProbability,
        daysUntilChurn,
        signals,
        recommendedAction,
      });
    }
  }

  return predictions.sort((a, b) => b.churnProbability - a.churnProbability);
}

export async function identifyAllUpsells(
  organizationId: string
): Promise<UpsellOpportunity[]> {
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    select: { id: true },
    take: 1000,
  });

  const opportunities: UpsellOpportunity[] = [];

  for (const contact of contacts) {
    const opportunity = await identifyUpsellOpportunities(contact.id);
    if (opportunity && opportunity.confidence > 0.6) {
      opportunities.push(opportunity);
    }
  }

  return opportunities.sort((a, b) => b.confidence - a.confidence);
}
