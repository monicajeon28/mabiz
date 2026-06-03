import prisma from "@/lib/prisma";

export interface PartnerChurnSignal {
  partnerId: string;
  partnerName: string;
  churnRiskScore: number; // 0-100
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  signals: {
    noSalesInDays: number | null;
    revenueDeclinePercent: number | null;
    leadQualityDecline: boolean;
    supportTicketsUnresolved: number;
    commissionDelayDays: number | null;
    lastActivityDays: number;
  };
  recommendedActions: string[];
}

export async function detectPartnerChurnRisk(
  partnerId: string
): Promise<PartnerChurnSignal | null> {
  try {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) return null;

    // Fetch affiliate sales separately (Partner doesn't have direct relation)
    const affiliateSales = await prisma.affiliateSale.findMany({
      where: { affiliateCode: partnerId },
      orderBy: { createdAt: "desc" },
      take: 180, // 6개월
    });

    let riskScore = 0;
    const signals = {
      noSalesInDays: null as number | null,
      revenueDeclinePercent: null as number | null,
      leadQualityDecline: false,
      supportTicketsUnresolved: 0,
      commissionDelayDays: null as number | null,
      lastActivityDays: 0,
    };

    // 1. No Sales in X Days
    const lastSale = affiliateSales?.[0];
    if (lastSale) {
      const daysSinceLastSale = Math.floor(
        (Date.now() - new Date(lastSale.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      signals.noSalesInDays = daysSinceLastSale;

      if (daysSinceLastSale > 90) {
        riskScore += 40; // Critical
      } else if (daysSinceLastSale > 30) {
        riskScore += 20; // High
      } else if (daysSinceLastSale > 14) {
        riskScore += 10; // Medium
      }
    } else {
      riskScore += 50; // No sales ever
    }

    // 2. Revenue Decline (month-over-month)
    if (affiliateSales && affiliateSales.length > 30) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const recentRevenue = affiliateSales
        .filter((s) => new Date(s.createdAt) > thirtyDaysAgo)
        .reduce((sum, s) => sum + (s.saleAmount - (s.refundedAmount || 0)), 0);

      const previousRevenue = affiliateSales
        .filter(
          (s) =>
            new Date(s.createdAt) > sixtyDaysAgo &&
            new Date(s.createdAt) <= thirtyDaysAgo
        )
        .reduce((sum, s) => sum + (s.saleAmount - (s.refundedAmount || 0)), 0);

      if (previousRevenue > 0) {
        const declinePercent =
          ((previousRevenue - recentRevenue) / previousRevenue) * 100;
        signals.revenueDeclinePercent = Math.max(0, declinePercent);

        if (declinePercent > 50) {
          riskScore += 30;
        } else if (declinePercent > 25) {
          riskScore += 15;
        } else if (declinePercent > 10) {
          riskScore += 5;
        }
      }
    }

    // 3. Last Activity Days
    signals.lastActivityDays = lastSale
      ? Math.floor(
          (Date.now() - new Date(lastSale.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 365;

    // 4. Commission Payment Delays (if applicable)
    const lastSettlement = await prisma.monthlySettlement.findFirst({
      where: {
        organizationId: partner.organizationId,
        status: { in: ["DRAFT", "APPROVED"] },
      },
      orderBy: { periodEnd: "desc" },
    });

    if (lastSettlement && lastSettlement.paymentDate) {
      const delayDays = Math.floor(
        (new Date(lastSettlement.paymentDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );
      signals.commissionDelayDays = Math.max(0, -delayDays); // Negative = past due
      if (delayDays < -14) {
        riskScore += 25; // Payment overdue
      }
    }

    // 5. Lead Quality Decline (low confirmation rate)
    const totalLeads = affiliateSales?.length || 0;
    const confirmedLeads =
      affiliateSales?.filter((s) => s.status === "CONFIRMED").length ||
      0;

    if (totalLeads > 10) {
      const confirmationRate = confirmedLeads / totalLeads;
      if (confirmationRate < 0.2) {
        signals.leadQualityDecline = true;
        riskScore += 15;
      }
    }

    // Determine severity
    let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (riskScore >= 80) {
      severity = "CRITICAL";
    } else if (riskScore >= 60) {
      severity = "HIGH";
    } else if (riskScore >= 40) {
      severity = "MEDIUM";
    }

    // Recommended actions
    const actions: string[] = [];
    if (signals.noSalesInDays && signals.noSalesInDays > 30) {
      actions.push("📞 파트너와 직접 통화 실시");
      actions.push("📧 재계약 검토 제안 이메일 발송");
    }
    if (
      signals.revenueDeclinePercent &&
      signals.revenueDeclinePercent > 25
    ) {
      actions.push("📊 마케팅 지원 강화 (광고비 지원 검토)");
      actions.push("🎯 판매 교육 및 코칭 세션 제공");
    }
    if (signals.leadQualityDecline) {
      actions.push("✅ 리드 검증 프로세스 개선");
      actions.push("📋 기준 충족 안 되는 리드 재교육");
    }
    if (signals.commissionDelayDays && signals.commissionDelayDays > 14) {
      actions.push("💰 미지급 정산금 확인 및 가속 처리");
    }

    return {
      partnerId,
      partnerName: partner.name,
      churnRiskScore: Math.min(100, riskScore),
      severity,
      signals,
      recommendedActions: actions,
    };
  } catch (err) {
    console.error("[Partner Churn] Detection failed", err);
    return null;
  }
}

export async function detectAllChurnRisks(
  organizationId: string
): Promise<PartnerChurnSignal[]> {
  const partners = await prisma.partner.findMany({
    where: { organizationId },
    select: { id: true },
  });

  const results: PartnerChurnSignal[] = [];
  for (const partner of partners) {
    const signal = await detectPartnerChurnRisk(partner.id);
    if (signal && signal.severity !== "LOW") {
      results.push(signal);
    }
  }

  return results.sort((a, b) => b.churnRiskScore - a.churnRiskScore);
}

export async function alertChurnAtRiskPartners(
  organizationId: string
): Promise<{ alerted: number; critical: number }> {
  const atRiskPartners = await detectAllChurnRisks(organizationId);
  const criticalPartners = atRiskPartners.filter(
    (p) => p.severity === "CRITICAL"
  );

  // TODO: Send alerts to organization admins
  // TODO: Create tasks/reminders for account managers
  console.log(
    `[Partner Churn] ${atRiskPartners.length} at-risk partners, ${criticalPartners.length} critical`
  );

  return {
    alerted: atRiskPartners.length,
    critical: criticalPartners.length,
  };
}
