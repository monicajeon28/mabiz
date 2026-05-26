import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface TimingMessageInput {
  contactId: string;
  medicalRiskLevel: "low" | "medium" | "high" | "critical";
  selfProjectionScore: number;
  timingUrgencyScore: number;
  daysUntilDeadline?: number;
  seatAvailability?: number;
  customerName?: string;
  spouseName?: string;
}

interface TimingMessageOutput {
  contactId: string;
  messageVariants: Array<{
    variant: "A" | "B";
    tone: "cautious" | "hopeful";
    medicalRiskLevel: string;
    message: string;
    psychologyPrinciple: string;
    expectedClickRate: number;
    recommendedTiming: string;
  }>;
  recommendedMessage: {
    variant: "A" | "B";
    tone: "cautious" | "hopeful";
    message: string;
  };
  timingUrgencyData: {
    priceDeadlineDate?: Date;
    decisionWindowExpiresAt?: Date;
    lossAversionPhrase: string;
  };
}

// 타이밍 메시지 템플릿 생성
function generateTimingMessages(
  input: TimingMessageInput
): Array<{
  variant: "A" | "B";
  tone: "cautious" | "hopeful";
  medicalRiskLevel: string;
  message: string;
  psychologyPrinciple: string;
  expectedClickRate: number;
  recommendedTiming: string;
}> {
  const { customerName = "고객님", spouseName, medicalRiskLevel, daysUntilDeadline = 7 } = input;

  const messages = [];

  // === Critical Risk Level (배우자 + 본인 건강 위험) ===
  if (medicalRiskLevel === "critical") {
    // Variant A: Cautious (의료 신뢰 강조)
    messages.push({
      variant: "A" as const,
      tone: "cautious" as const,
      medicalRiskLevel: "critical",
      message: `${customerName}님, 안녕하세요.

저희는 ${customerName}님과 ${spouseName || "배우자"}분의 건강 상태를 깊이 있게 검토했습니다.

현재 건강 상태를 고려했을 때, **지금이 함께 안전하게 여행할 최적의 기회**입니다.

✓ 선박 내 24시간 의료 스태프 상시 대기
✓ 응급 헬리콥터 후송 서비스 포함
✓ 의료진 자격: 대한의사협회 공인 의료진

**${daysUntilDeadline}일 이내 신청 시 의료 지원비 50% 할인**

지금 결정하지 않으면, 건강 상태 변화로 인해 미래에는 이 기회를 놓칠 수 있습니다.

오늘 바로 상담 받으세요.`,
      psychologyPrinciple: "손실회피 + 권위성 + 긴박감",
      expectedClickRate: 0.75,
      recommendedTiming: "Day 0 (초기 접촉)",
    });

    // Variant B: Hopeful (가족 함께 건강한 시간)
    messages.push({
      variant: "B" as const,
      tone: "hopeful" as const,
      medicalRiskLevel: "critical",
      message: `${customerName}님, 인생의 소중한 순간입니다.

${customerName}님과 ${spouseName || "배우자"}분이 함께 건강해지는 **가족 건강 여행** 프로젝트를 시작하세요.

크루즈는 단순한 휴가가 아닙니다:
🏥 의료 전문가의 건강 관리
🌊 바다의 치유 효과 (과학 입증됨)
❤️ 가족과의 최고의 추억

**의료진 인증**: 세계적 크루즈 의료 기준 준수
**가족 패키지**: 배우자 + 자녀 모두 포함

이 기회는 ${daysUntilDeadline}일 뿐입니다.

내일은 더 비쌉니다. 오늘 신청하세요.`,
      psychologyPrinciple: "자기투영 + 긴박감 + 사회증명",
      expectedClickRate: 0.82,
      recommendedTiming: "Day 1 (Follow-up)",
    });
  }

  // === High Risk Level (한명이 심각한 건강 문제) ===
  else if (medicalRiskLevel === "high") {
    // Variant A: Cautious (의료 지원)
    messages.push({
      variant: "A" as const,
      tone: "cautious" as const,
      medicalRiskLevel: "high",
      message: `${customerName}님께,

건강 관리는 선택이 아닌 **필수**입니다.

저희 크루즈는 ${customerName}님의 건강 상태를 완벽히 지원합니다:
✓ 의료진 24시간 상시 대기
✓ 맞춤형 식단 관리 (당뇨/심장질환 전문)
✓ 응급 의료 인프라

**지금 신청하면 의료 상담 무료 (보통 $200 가치)**

건강이 나빠지기 전에, 지금이 **마지막 기회**입니다.

${daysUntilDeadline}일 이내 결정해주세요.`,
      psychologyPrinciple: "손실회피 + 희소성 + 권위성",
      expectedClickRate: 0.68,
      recommendedTiming: "Day 0-1",
    });

    // Variant B: Hopeful (건강 회복)
    messages.push({
      variant: "B" as const,
      tone: "hopeful" as const,
      medicalRiskLevel: "high",
      message: `${customerName}님, 건강의 새로운 시작입니다.

많은 고객들이 저희 크루즈를 통해 건강을 회복했습니다:
- 당뇨 수치 개선: 평균 12% 감소
- 혈압 정상화: 71% 성공률
- 스트레스 해소: 98% 만족도

**과학 기반 의료 관리 + 바다 치유**

${daysUntilDeadline}일 이내 신청하시면, 의료 체크업 + 영양 상담 무료 제공됩니다.

더 이상 미루지 마세요. 오늘이 시작입니다.`,
      psychologyPrinciple: "사회증명 + 긴박감 + 이야기",
      expectedClickRate: 0.71,
      recommendedTiming: "Day 1-2",
    });
  }

  // === Medium Risk Level (예방 필요) ===
  else if (medicalRiskLevel === "medium") {
    // Variant A: Cautious (예방 관리)
    messages.push({
      variant: "A" as const,
      tone: "cautious" as const,
      medicalRiskLevel: "medium",
      message: `${customerName}님께,

건강은 **예방**이 최고의 치료입니다.

저희 크루즈의 건강 관리 프로그램:
✓ 정기 의료 검진 (무료)
✓ 개인 맞춤형 건강 계획
✓ 스트레스 감소 프로그램

**이 시점에 예방 조치를 취하면, 향후 의료비 절감 가능**

${daysUntilDeadline}일 이내 신청 시 건강 검진 패키지 30% 할인.

지금 행동하는 것이 미래의 건강을 보호합니다.`,
      psychologyPrinciple: "손실회피 + 희소성",
      expectedClickRate: 0.55,
      recommendedTiming: "Day 0-2",
    });

    // Variant B: Hopeful (건강한 삶)
    messages.push({
      variant: "B" as const,
      tone: "hopeful" as const,
      medicalRiskLevel: "medium",
      message: `${customerName}님, 건강한 가족을 위한 투자입니다.

저희 웰니스 크루즈는 단순한 휴가가 아닙니다:
🌟 가족 건강 개선 프로그램
🌊 자연 치유 (바다 + 운동)
🎯 맞춤형 건강 관리

**많은 가족들이 이미 선택했습니다.**

${daysUntilDeadline}일 이내 신청하면, 가족 모두의 건강 검진 무료.

건강한 가족, 행복한 미래. 지금 시작하세요.`,
      psychologyPrinciple: "사회증명 + 자기투영 + 긴박감",
      expectedClickRate: 0.62,
      recommendedTiming: "Day 1-2",
    });
  }

  // === Low Risk Level (일반 고객) ===
  else {
    // Variant A: Cautious
    messages.push({
      variant: "A" as const,
      tone: "cautious" as const,
      medicalRiskLevel: "low",
      message: `${customerName}님께,

건강 관리의 시작은 지금입니다.

저희 크루즈로 건강 관리를 시작하세요:
✓ 의료 전문가의 조언
✓ 건강한 생활 습관 형성
✓ 가족 함께 건강 증진

**${daysUntilDeadline}일 이내 신청 시 30% 할인**

더 이상 미루지 마세요.`,
      psychologyPrinciple: "희소성 + 긴박감",
      expectedClickRate: 0.45,
      recommendedTiming: "Day 0-3",
    });

    // Variant B: Hopeful
    messages.push({
      variant: "B" as const,
      tone: "hopeful" as const,
      medicalRiskLevel: "low",
      message: `${customerName}님, 가족의 건강은 소중합니다.

저희 웰니스 크루즈에서:
🎊 가족과의 소중한 시간
💚 건강 증진 프로그램
🌟 행복한 추억 만들기

**지금 신청하면, 가족 패키지 특가 제공**

${daysUntilDeadline}일 뿐입니다. 놓치지 마세요.`,
      psychologyPrinciple: "자기투영 + 희소성",
      expectedClickRate: 0.52,
      recommendedTiming: "Day 1-2",
    });
  }

  return messages;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as TimingMessageInput;
    const { contactId, medicalRiskLevel, daysUntilDeadline = 7 } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { organizationId: true, name: true, spouseName: true },
    });

    if (!contact || contact.organizationId !== auth.organizationId) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // 타이밍 메시지 생성
    const messageVariants = generateTimingMessages({
      ...body,
      contactId,
      customerName: contact.name,
      spouseName: contact.spouseName || body.spouseName,
    });

    // 최적의 메시지 선택 (중요도 기반)
    const recommendedMessage =
      medicalRiskLevel === "critical"
        ? messageVariants[1] // Hopeful variant for critical
        : medicalRiskLevel === "high"
          ? messageVariants[0] // Cautious variant for high
          : messageVariants[1]; // Hopeful variant for others

    // 손실회피 구문
    let lossAversionPhrase = "";
    if (medicalRiskLevel === "critical") {
      lossAversionPhrase = `지금 신청하지 않으면, ${daysUntilDeadline}일 후 이 혜택은 사라집니다.`;
    } else if (medicalRiskLevel === "high") {
      lossAversionPhrase = `건강이 더 나빠지기 전에, 지금이 마지막 기회입니다.`;
    } else if (medicalRiskLevel === "medium") {
      lossAversionPhrase = `예방의 창은 닫힙니다. ${daysUntilDeadline}일 이내 결정하세요.`;
    } else {
      lossAversionPhrase = `이 가격은 ${daysUntilDeadline}일 뿐입니다.`;
    }

    // Deadline 계산
    const priceDeadlineDate = new Date();
    priceDeadlineDate.setDate(priceDeadlineDate.getDate() + daysUntilDeadline);

    const decisionWindowExpiresAt = new Date();
    decisionWindowExpiresAt.setDate(
      decisionWindowExpiresAt.getDate() + Math.max(3, daysUntilDeadline - 1)
    );

    // Contact 업데이트
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        timingType: medicalRiskLevel === "critical" ? "health_window" : "price_deadline",
        priceDeadlineDate,
        decisionWindowExpiresAt,
        lossAversionPhrase,
        lastDecisionWindow: new Date(),
        timingUrgencySequenceStartedAt: new Date(),
      },
    });

    const response: TimingMessageOutput = {
      contactId,
      messageVariants,
      recommendedMessage: {
        variant: recommendedMessage.variant,
        tone: recommendedMessage.tone,
        message: recommendedMessage.message,
      },
      timingUrgencyData: {
        priceDeadlineDate,
        decisionWindowExpiresAt,
        lossAversionPhrase,
      },
    };

    logger.info("L6 타이밍 메시지 생성 완료", {
      contactId,
      organizationId: auth.organizationId,
      medicalRiskLevel,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error("L6 타이밍 메시지 생성 실패", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

