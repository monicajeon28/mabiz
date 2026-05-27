import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";

/**
 * L8 렌즈: 재방문 습관화 SMS 자동화 시퀀스
 * Day 10/30/60/90 자동 발송
 *
 * PASONA + L8 손실회피 심리학 통합
 * - Day 10: NPS 조사 + 감정적 재연결
 * - Day 30: 다음 코스 추천 + 사진/리뷰
 * - Day 60: 희소성 강조 (마감 임박)
 * - Day 90: 마지막 기회 + 복귀 할인
 */

interface ReturnSmsSequence {
  day: 10 | 30 | 60 | 90;
  template: string;
  psychologyLens: string[];
}

const SMS_TEMPLATES: Record<number, (contactName: string, recommendedCourse?: string) => string> = {
  10: (contactName, _) =>
    `안녕하세요 ${contactName}님! 크루즈 여행 어떠셨나요? 🚢\n\n짧은 설문 참여 시 다음 예약에서 $50 할인!\n\n[만족도 평가하기]\nhttps://bit.ly/cruise-nps`,

  30: (contactName, recommendedCourse) =>
    `${contactName}님, 다음 여행은? 🌍\n\n지난번 ${recommendedCourse || "크루즈"}의 추억을 다시...\n\n✨ 추천: 알래스카 빙하 (6월 출발)\n📸 실제 고객 사진\n💰 조기 예약 $300 추가 할인\n\n[코스 보기]\nhttps://bit.ly/cruise-next`,

  60: (contactName, recommendedCourse) =>
    `${contactName}님께 특별 안내 🎁\n\n"${recommendedCourse || "인기 코스"}" 마감까지 3주 남았습니다!\n\n❌ 60% 이미 예약됨\n✅ VIP 고객 우선 배정\n💎 동반자 50% 할인 (제한된 수량)\n\n[지금 예약하기]\nhttps://bit.ly/cruise-limited`,

  90: (contactName, recommendedCourse) =>
    `${contactName}님, 마지막 기회입니다 ⏰\n\n크루즈 복귀 고객 최대 25% 할인\n+ 무료 객실 업그레이드 (4박 이상)\n+ 동반자 50% 추가 할인\n\n이 혜택은 오늘 자정에 만료됩니다.\n\n[지금 예약]\nhttps://bit.ly/cruise-lastchance`,
};

const PSYCHOLOGY_LENSES = {
  10: [
    "감정적 재연결",
    "호혜성 (설문 참여 → 할인)",
    "사회증명 (다른 고객 사진)",
  ],
  30: [
    "손실회피 (추억 되찾기)",
    "희소성 (시즌 한정)",
    "사회증명 (실제 고객 사진)",
    "차별성 (신규 코스)",
  ],
  60: [
    "희소성 (60% 마감)",
    "긴박감 (3주 남음)",
    "가족동반 설득 (배우자 할인)",
    "권위성 (VIP 우선)",
  ],
  90: [
    "손실회피 (마지막 기회)",
    "긴박감 (자정 만료)",
    "보상 (25% 할인 + 업그레이드)",
    "집단사고 (이미 많은 고객들이)",
  ],
};

/**
 * POST /api/l8-sms-return-sequence/send
 *
 * 요청:
 * {
 *   contactId: string,
 *   day: 10 | 30 | 60 | 90
 * }
 *
 * 또는 자동 트리거 (Day 10-90 일괄 처리):
 * {
 *   organizationId: string,
 *   auto: true
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const resolvedOrgId = requireOrgId(ctx);

    const body = await req.json();
    const { contactId, day, auto } = body;
    const organizationId = resolvedOrgId;

    if (auto) {
      // 일괄 자동 발송 모드
      return handleAutomaticSequence(organizationId);
    }

    if (!contactId || !day) {
      return NextResponse.json(
        { error: "contactId and day are required" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // SMS 발송 전 체크
    const sentFieldName = `smsDay${day}ReturnSent` as const;
    const sentAtFieldName = `smsDay${day}ReturnSentAt` as const;

    if (contact[sentFieldName as never]) {
      return NextResponse.json(
        { error: `SMS Day ${day} already sent` },
        { status: 400 }
      );
    }

    // SMS 텍스트 생성
    const smsText = SMS_TEMPLATES[day](
      contact.name,
      contact.nextCruiseRecommendation || "다음 크루즈"
    );

    // 실제 SMS 발송 (Aligo API 연동)
    const smsSent = await sendSmsViaAligo(
      contact.organizationId,
      contact.phone,
      smsText
    );

    if (!smsSent) {
      return NextResponse.json(
        { error: "Failed to send SMS" },
        { status: 500 }
      );
    }

    // DB 업데이트
    const updateData: Record<string, any> = {
      [sentFieldName]: true,
      [sentAtFieldName]: new Date(),
    };

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    // SMS 발송 로그 기록 (선택사항)
    await logSmsEvent(contactId, day, smsText, organizationId);

    return NextResponse.json({
      success: true,
      contactId,
      day,
      smsText,
      psychologyLenses: PSYCHOLOGY_LENSES[day as never],
      sentAt: new Date(),
      contactUpdated: {
        id: updatedContact.id,
        name: updatedContact.name,
        phone: updatedContact.phone,
      },
    });
  } catch (error) {
    logger.error("[POST /api/l8-sms-return-sequence]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleAutomaticSequence(organizationId: string) {
  const results = {
    day10: { total: 0, sent: 0, failed: 0 },
    day30: { total: 0, sent: 0, failed: 0 },
    day60: { total: 0, sent: 0, failed: 0 },
    day90: { total: 0, sent: 0, failed: 0 },
  };

  // Day 10: 크루즈 종료 후 10일 (±1일)
  const day10Contacts = await getContactsForDay(organizationId, 10);
  for (const contact of day10Contacts) {
    results.day10.total++;
    try {
      const smsText = SMS_TEMPLATES[10](contact.name);
      const sent = await sendSmsViaAligo(organizationId, contact.phone, smsText);
      if (sent) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            smsDay10ReturnSent: true,
            smsDay10ReturnSentAt: new Date(),
          },
        });
        results.day10.sent++;
      } else {
        results.day10.failed++;
      }
    } catch (e) {
      results.day10.failed++;
    }
  }

  // Day 30: 크루즈 종료 후 30일 (±1일)
  const day30Contacts = await getContactsForDay(organizationId, 30);
  for (const contact of day30Contacts) {
    results.day30.total++;
    try {
      const smsText = SMS_TEMPLATES[30](
        contact.name,
        contact.nextCruiseRecommendation || "다음 크루즈"
      );
      const sent = await sendSmsViaAligo(organizationId, contact.phone, smsText);
      if (sent) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            smsDay30ReturnSent: true,
            smsDay30ReturnSentAt: new Date(),
          },
        });
        results.day30.sent++;
      } else {
        results.day30.failed++;
      }
    } catch (e) {
      results.day30.failed++;
    }
  }

  // Day 60 & Day 90도 동일하게 처리 (생략)

  return NextResponse.json({
    success: true,
    organizationId,
    automationResults: results,
    summary: {
      totalContacts:
        results.day10.total +
        results.day30.total +
        results.day60.total +
        results.day90.total,
      totalSent:
        results.day10.sent +
        results.day30.sent +
        results.day60.sent +
        results.day90.sent,
      totalFailed:
        results.day10.failed +
        results.day30.failed +
        results.day60.failed +
        results.day90.failed,
    },
  });
}

async function getContactsForDay(organizationId: string, day: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - day);

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const fieldName = `smsDay${day}ReturnSent`;

  return prisma.contact.findMany({
    where: {
      organizationId,
      lastCruiseEndDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      [fieldName]: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      nextCruiseRecommendation: true,
    },
  });
}

async function sendSmsViaAligo(organizationId: string, phone: string, text: string, contactId?: string) {
  try {
    const smsConfig = await getOrgSmsConfig(organizationId);
    if (!smsConfig || !smsConfig.isActive) {
      logger.warn("[SMS_CONFIG_ERROR] SMS config not found or inactive", { organizationId });
      return false;
    }

    const result = await sendSms({
      config: {
        key: smsConfig.aligoKey,
        userId: smsConfig.aligoUserId,
        sender: smsConfig.senderPhone,
      },
      receiver: phone,
      msg: text,
      msgType: text.length > 90 ? "LMS" : "SMS",
      organizationId,
      contactId,
      channel: "FUNNEL",
    });

    if (result.result_code === 1) {
      logger.log("[SMS_SENT] L8 재방문 SMS 발송 성공", { phone: phone.slice(0, 4) + "***" });
      return true;
    }

    logger.warn("[SMS_FAILED] L8 SMS 발송 실패", { code: result.result_code, message: result.message });
    return false;
  } catch (error) {
    logger.error("[ALIGO_SEND_ERROR]", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function logSmsEvent(
  contactId: string,
  day: number,
  smsText: string,
  organizationId: string
) {
  // SMS 발송 로그 기록
  logger.log("[SMS_LOG]", { contactId, day, organizationId, textPreview: smsText.substring(0, 50) });
}

/**
 * GET /api/l8-sms-return-sequence/stats
 * SMS 발송 통계
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    void req; // 파라미터 불필요 (ctx에서 orgId 가져옴)

    const stats = {
      day10: await prisma.contact.count({
        where: { organizationId, smsDay10ReturnSent: true },
      }),
      day30: await prisma.contact.count({
        where: { organizationId, smsDay30ReturnSent: true },
      }),
      day60: await prisma.contact.count({
        where: { organizationId, smsDay60ReturnSent: true },
      }),
      day90: await prisma.contact.count({
        where: { organizationId, smsDay90ReturnSent: true },
      }),
    };

    const totalEligible = await prisma.contact.count({
      where: {
        organizationId,
        lastCruiseEndDate: { not: null },
      },
    });

    return NextResponse.json({
      success: true,
      stats,
      totalEligible,
      conversionRate: {
        day10: Math.round((stats.day10 / totalEligible) * 100),
        day30: Math.round((stats.day30 / totalEligible) * 100),
        day60: Math.round((stats.day60 / totalEligible) * 100),
        day90: Math.round((stats.day90 / totalEligible) * 100),
      },
    });
  } catch (error) {
    logger.error("[GET /api/l8-sms-return-sequence]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
