/**
 * Menu #57: POST /api/partner/alert/risk-flag
 * 파트너 위험 신호 자동 감지 및 알림
 *
 * Request:
 * {
 *   "partnerId": "partner_123",
 *   "riskType": "low_performance" | "churn_indicator" | "dishonesty" | "skill_gap",
 *   "action": "auto_alert" | "manual_review",
 *   "severity": "high" | "medium" | "low"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "riskFlagId": "flag_123",
 *   "totalRiskScore": 65,
 *   "interventionTriggered": true,
 *   "alertSent": true,
 *   "interventionScheduled": "2026-06-10"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface RiskFlagRequest {
  partnerId: string;
  riskType: "low_performance" | "churn_indicator" | "dishonesty" | "skill_gap";
  action: "auto_alert" | "manual_review";
  severity?: "high" | "medium" | "low";
  reason?: string;
}

const RISK_SCORE_MAP: Record<string, number> = {
  low_performance_high: 40,
  low_performance_medium: 25,
  low_performance_low: 15,
  churn_indicator_high: 35,
  churn_indicator_medium: 20,
  churn_indicator_low: 10,
  dishonesty_high: 50,
  dishonesty_medium: 35,
  dishonesty_low: 20,
  skill_gap_high: 30,
  skill_gap_medium: 20,
  skill_gap_low: 10,
};

async function sendAlertNotification(
  partnerId: string,
  riskType: string,
  severity: string,
  partnerId_name: string
) {
  // 실제 구현: 이메일/SMS 발송
  // 여기서는 로그만 출력
  logger.info('[ALERT] Partner risk notification', { partnerName: partnerId_name, partnerId, riskType, severity });

  // TODO: Aligo SMS API 통합
  // const sms = await sendPartnerAlert(
  //   partner.phone,
  //   `파트너님, ${riskType} 신호가 감지되었습니다. 담당자와 상담하세요.`
  // );

  // TODO: 이메일 발송
  // const email = await sendPartnerEmail(
  //   partner.email,
  //   "위험 신호 알림",
  //   `파트너님의 ${riskType} 위험도가 높습니다.`
  // );
}

export async function POST(request: NextRequest) {
  try {
    const body: RiskFlagRequest = await request.json();
    const {
      partnerId,
      riskType,
      action,
      severity = "medium",
      reason,
    } = body;

    if (!partnerId || !riskType || !action) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다" },
        { status: 400 }
      );
    }

    // 파트너 존재 여부 확인
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { riskFlags: true },
    });

    if (!partner) {
      return NextResponse.json(
        { error: "파트너를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Risk Flag 조회 또는 생성
    let riskFlags = partner.riskFlags;
    if (!riskFlags) {
      riskFlags = await prisma.partnerRiskFlags.create({
        data: { partnerId },
      });
    }

    // Risk Score 계산
    const scoreKey = `${riskType}_${severity}`;
    const scoreIncrement = RISK_SCORE_MAP[scoreKey] || 20;

    // Risk Type별 필드 업데이트
    const updateData: any = {};
    const flagsUpdate: any = {};

    switch (riskType) {
      case "low_performance":
        updateData.lowPerformance = true;
        updateData.lowPerformanceScore = Math.min(
          100,
          (riskFlags.lowPerformanceScore || 0) + scoreIncrement
        );
        flagsUpdate.lowPerformance = true;
        flagsUpdate.lowPerformanceScore = updateData.lowPerformanceScore;
        break;
      case "churn_indicator":
        updateData.churnIndicator = true;
        updateData.churnScore = Math.min(
          100,
          (riskFlags.churnScore || 0) + scoreIncrement
        );
        flagsUpdate.churnIndicator = true;
        flagsUpdate.churnScore = updateData.churnScore;
        break;
      case "dishonesty":
        updateData.dishonesty = true;
        updateData.dishonestyScore = Math.min(
          100,
          (riskFlags.dishonestyScore || 0) + scoreIncrement
        );
        flagsUpdate.dishonesty = true;
        flagsUpdate.dishonestyScore = updateData.dishonestyScore;
        break;
      case "skill_gap":
        updateData.skillGap = true;
        updateData.skillGapScore = Math.min(
          100,
          (riskFlags.skillGapScore || 0) + scoreIncrement
        );
        flagsUpdate.skillGap = true;
        flagsUpdate.skillGapScore = updateData.skillGapScore;
        break;
    }

    // 통합 위험도 계산
    const totalRiskScore =
      (updateData.lowPerformanceScore || riskFlags.lowPerformanceScore || 0) +
      (updateData.churnScore || riskFlags.churnScore || 0) +
      (updateData.dishonestyScore || riskFlags.dishonestyScore || 0) +
      (updateData.skillGapScore || riskFlags.skillGapScore || 0);

    const normalizedRiskScore = Math.min(100, Math.round(totalRiskScore / 4));

    // 자동 개입 트리거
    let interventionTriggered = false;
    if (normalizedRiskScore >= 60 && !riskFlags.interventionTriggeredAt) {
      interventionTriggered = true;
      updateData.interventionTriggeredAt = new Date();
      flagsUpdate.interventionTriggeredAt = new Date();
    }

    // 최종 업데이트
    updateData.totalRiskScore = normalizedRiskScore;
    flagsUpdate.totalRiskScore = normalizedRiskScore;
    flagsUpdate.reviewNotes = reason || `${riskType} 신호 감지`;
    flagsUpdate.lastReviewedAt = new Date();

    // DB 업데이트
    const updatedRiskFlags = await prisma.partnerRiskFlags.update({
      where: { id: riskFlags.id },
      data: flagsUpdate,
    });

    // 알림 발송
    if (action === "auto_alert") {
      await sendAlertNotification(partnerId, riskType, severity, partner.name);
    }

    // 예정된 개입 날짜 (3일 이내)
    const interventionScheduled = new Date();
    interventionScheduled.setDate(interventionScheduled.getDate() + 3);

    // PartnerPerformance의 riskFlags 필드도 업데이트
    const latestPerformance = await prisma.partnerPerformance.findFirst({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
    });

    if (latestPerformance) {
      const existingFlags = Array.isArray(latestPerformance.riskFlags)
        ? latestPerformance.riskFlags
        : [];
      const updatedFlags = Array.from(new Set([...existingFlags, riskType]));

      await prisma.partnerPerformance.update({
        where: { id: latestPerformance.id },
        data: {
          riskScore: normalizedRiskScore,
          riskFlags: updatedFlags,
        },
      });
    }

    return NextResponse.json({
      success: true,
      riskFlagId: updatedRiskFlags.id,
      partnerId,
      partnerName: partner.name,
      riskType,
      severity,
      lowPerformanceScore: updatedRiskFlags.lowPerformanceScore,
      churnScore: updatedRiskFlags.churnScore,
      dishonestyScore: updatedRiskFlags.dishonestyScore,
      skillGapScore: updatedRiskFlags.skillGapScore,
      totalRiskScore: normalizedRiskScore,
      interventionTriggered,
      interventionScheduled: interventionScheduled
        .toISOString()
        .split("T")[0],
      alertSent: action === "auto_alert",
      message:
        normalizedRiskScore >= 60
          ? "긴급: 즉시 담당자 개입이 필요합니다"
          : normalizedRiskScore >= 40
            ? "주의: 주간 리뷰 권장"
            : "정상: 모니터링 계속",
    });
  } catch (error) {
    logger.error('[POST /api/partner/alert/risk-flag]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "위험 신호 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/alert/risk-flag?partnerId=...
 * 특정 파트너의 현재 위험도 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId는 필수입니다" },
        { status: 400 }
      );
    }

    const riskFlags = await prisma.partnerRiskFlags.findUnique({
      where: { partnerId },
    });

    if (!riskFlags) {
      return NextResponse.json(
        { error: "위험 신호 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      partnerId,
      riskFlags: {
        lowPerformance: riskFlags.lowPerformance,
        lowPerformanceScore: riskFlags.lowPerformanceScore,
        churnIndicator: riskFlags.churnIndicator,
        churnScore: riskFlags.churnScore,
        dishonesty: riskFlags.dishonesty,
        dishonestyScore: riskFlags.dishonestyScore,
        skillGap: riskFlags.skillGap,
        skillGapScore: riskFlags.skillGapScore,
      },
      totalRiskScore: riskFlags.totalRiskScore,
      status:
        riskFlags.totalRiskScore >= 60
          ? "Critical"
          : riskFlags.totalRiskScore >= 40
            ? "Warning"
            : "Normal",
      interventionTriggeredAt: riskFlags.interventionTriggeredAt,
      lastReviewedAt: riskFlags.lastReviewedAt,
      reviewNotes: riskFlags.reviewNotes,
    });
  } catch (error) {
    logger.error('[GET /api/partner/alert/risk-flag]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "위험 신호 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

