import prisma from "@/lib/prisma";

export interface RiskAlert {
  contactId: string;
  name: string;
  phone: string;
  riskLevel: "danger" | "warning" | "info"; // 빨강/노랑/파랑
  riskReason: string;
  daysOverdue: number;
  recommendation: string; // "다시 전화" or "포기"
  urgency: "지금 당장" | "오늘 중" | "내일까지";
}

export async function generateRiskAlerts(
  organizationId: string
): Promise<RiskAlert[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // 위험한 Contact들 추출 (미구매 + 미완료)
  const riskContacts = await prisma.contact.findMany({
    where: {
      organizationId,
      // 계약 미완료만 (purchasedAt 없음)
      purchasedAt: null,
      deletedAt: null,
    },
  });

  const alerts: RiskAlert[] = [];

  for (const contact of riskContacts) {
    let alert: RiskAlert | null = null;

    // 기본: createdAt이 없으면 skip (매우 이상한 경우)
    if (!contact.createdAt) continue;

    const daysSinceCreation = Math.floor(
      (now.getTime() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 🔴 위험 1: 7일 이상 미응답 (lastContactedAt가 7일 이상 전)
    if (daysSinceCreation >= 7) {
      const daysWithoutContact = contact.lastContactedAt
        ? Math.floor(
            (now.getTime() - contact.lastContactedAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : daysSinceCreation;

      if (daysWithoutContact >= 7) {
        alert = {
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          riskLevel: "danger",
          riskReason: `신청 후 ${daysSinceCreation}일 경과, 마지막 접촉 ${daysWithoutContact}일 전`,
          daysOverdue: daysWithoutContact - 7,
          recommendation:
            daysWithoutContact > 14 ? "포기 (재타겟팅)" : "재접근 (전화)",
          urgency: "지금 당장",
        };
      }
    }

    // 🟡 경고 2: 기한 임박 (departureDate가 48시간 미만)
    else if (contact.departureDate) {
      const hoursLeft = Math.floor(
        (contact.departureDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      if (hoursLeft > 0 && hoursLeft <= 48) {
        alert = {
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          riskLevel: "warning",
          riskReason: `예정 출발 ${hoursLeft}시간 남음 (${new Date(
            contact.departureDate
          ).toLocaleDateString("ko-KR")})`,
          daysOverdue: 0,
          recommendation: "긴박감 메시지 발송 + 전화",
          urgency: "오늘 중",
        };
      }
    }

    // 🔵 정보: 준비 부족 (anxietyCategory, preparationStage 확인)
    if (!alert) {
      const isInPreparation =
        contact.preparationStage &&
        ["visa_concern", "health_concern", "passport_concern"].includes(
          contact.preparationStage
        );
      const hasHighAnxiety = contact.anxietyScore > 50;
      const hasMemo = contact.adminMemo?.includes("준비 부족");

      if (isInPreparation || hasHighAnxiety || hasMemo) {
        alert = {
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          riskLevel: "info",
          riskReason:
            contact.preparationStage === "visa_concern"
              ? "비자 준비 진행 중"
              : contact.preparationStage === "health_concern"
                ? "건강 관련 준비 진행 중"
                : contact.preparationStage === "passport_concern"
                  ? "여권 준비 진행 중"
                  : "준비 과정 중, 재설명 필요",
          daysOverdue: 0,
          recommendation: "준비 단계 차별성 설명 콜",
          urgency: "내일까지",
        };
      }
    }

    if (alert) {
      alerts.push(alert);
    }
  }

  return alerts.sort((a, b) => {
    const levelScore = { danger: 3, warning: 2, info: 1 };
    return levelScore[b.riskLevel] - levelScore[a.riskLevel];
  });
}
