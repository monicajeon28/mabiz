import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendSmsViaAligo } from "@/lib/sms-service";

type Params = { params: Promise<{ id: string }> };

// L6 Day 0 SMS 템플릿
const L6_DAY0_SMS = (customerName: string, currentPrice: number, futurePrice: number, hoursUntilIncrease: number) => `
크루즈닷입니다! 😊
${customerName}님의 여행 신청 감사합니다.

알려드릴 게 있는데요 ⏰

🚢 지금 신청: $${currentPrice}
📅 ${hoursUntilIncrease}시간 뒤: $${futurePrice} (가격 인상)
🪑 자리: 남은 자리 감소 중

서두르지 않으셔도 괜찮지만,
시간이 지날수록 선택지가 줄어들어요.

더 알고 싶으신가요?
전화 상담 → 1899-4798
카톡 상담 → pf.kakao.com/_cruisedot
`;

// POST /api/landing-pages/[id]/sms-trigger
// L6 Day 0 SMS 발송 트리거 (폼 제출 후 자동 호출)
// P1-24: phoneNumber/customerName은 클라이언트에서 받지 않고 DB에서 직접 조회
export async function POST(req: Request, { params }: Params) {
  try {
    const { id: landingPageId } = await params;
    const body = await req.json();
    const { registrationId, messageType } = body;

    if (!registrationId) {
      return NextResponse.json(
        { ok: false, message: "필수 파라미터 누락" },
        { status: 400 }
      );
    }

    if (messageType !== "l6_day0") {
      return NextResponse.json(
        { ok: false, message: "지원하지 않는 메시지 타입" },
        { status: 400 }
      );
    }

    // P1-24: 전화번호/이름을 DB에서 직접 조회 (클라이언트 신뢰 불필요)
    // [T9] landingPageId 교차 검증: registration이 해당 landingPageId에 속하는지 확인
    const registration = await prisma.crmLandingRegistration.findUnique({
      where: { id: registrationId },
      select: { phone: true, name: true, landingPageId: true, createdAt: true },
    });

    if (!registration) {
      return NextResponse.json(
        { ok: false, message: "등록 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 1시간 이내 등록만 허용 (in-memory rate limit 대신 시간 기반)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (Date.now() - registration.createdAt.getTime() > ONE_HOUR_MS) {
      logger.warn("[L6SmsTrigger] 등록 후 1시간 초과 — SMS 트리거 거부", {
        registrationId,
        createdAt: registration.createdAt,
      });
      return NextResponse.json(
        { ok: false, message: "SMS 트리거 유효 시간이 초과되었습니다." },
        { status: 410 }
      );
    }

    // [T9] landingPageId 불일치 = 타 페이지 registration 악용 방지
    if (registration.landingPageId !== landingPageId) {
      logger.warn("[L6SmsTrigger] landingPageId 불일치 — 교차 접근 차단", {
        registrationId,
        expected: landingPageId,
        actual: registration.landingPageId,
      });
      return NextResponse.json(
        { ok: false, message: "등록 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const phoneNumber = registration.phone;
    const customerName = registration.name;

    // 랜딩페이지 L6 설정 조회
    const landingPage = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, isActive: true },
      select: {
        id: true,
        l6Enabled: true,
        l6PriceAnchors: true,
        l6CountdownEnd: true,
        smsL6Day0Enabled: true,
      },
    });

    if (!landingPage?.l6Enabled || !landingPage.smsL6Day0Enabled) {
      return NextResponse.json({
        ok: true,
        message: "L6 SMS 자동화 비활성화 상태",
      });
    }

    // [T14] opt-out 고객 SMS 차단: Contact.optOutAt 확인
    // [P1-5] organizationId를 직접 조회 (organization.findFirst() 신뢰성 개선)
    const landingPageOrg = await prisma.crmLandingPage.findUnique({
      where: { id: landingPageId },
      select: { organizationId: true },
    });

    if (!landingPageOrg?.organizationId) {
      logger.warn("[L6SmsTrigger] organizationId 조회 실패", { landingPageId });
      return NextResponse.json(
        { ok: false, message: "조직 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const org = { id: landingPageOrg.organizationId };

    if (org) {
      const contact = await prisma.contact.findFirst({
        where: { phone: phoneNumber, organizationId: org.id },
        select: { optOutAt: true },
      });
      if (contact?.optOutAt) {
        logger.info("[L6SmsTrigger] 수신 거부 고객 — SMS 발송 건너뜀", {
          registrationId,
          optOutAt: contact.optOutAt,
        });
        return NextResponse.json({
          ok: true,
          message: "수신 거부 고객입니다.",
          smsSent: false,
        });
      }
    }

    // [버그2] SmsOptOut 글로벌 옵트아웃 체크
    const globalOptOut = await prisma.smsOptOut.findFirst({
      where: { phone: phoneNumber },
      select: { id: true },
    });
    if (globalOptOut) {
      logger.info("[L6SmsTrigger] 글로벌 수신 거부(SmsOptOut) — SMS 발송 건너뜀", {
        registrationId,
      });
      return NextResponse.json({
        ok: true,
        message: "수신 거부 고객입니다.",
        smsSent: false,
      });
    }

    // SMS 콘텐츠 조립
    const priceAnchors = landingPage.l6PriceAnchors
      ? Array.isArray(landingPage.l6PriceAnchors)
        ? landingPage.l6PriceAnchors
        : JSON.parse(String(landingPage.l6PriceAnchors))
      : [{ price: 1200 }, { price: 1240 }];

    const currentPrice = priceAnchors[0]?.price ?? 1200;
    const futurePrice = priceAnchors[1]?.price ?? 1240;

    const countdownTarget = landingPage.l6CountdownEnd
      ? new Date(landingPage.l6CountdownEnd)
      : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const hoursUntilIncrease = Math.max(
      1,
      Math.floor((countdownTarget.getTime() - Date.now()) / (60 * 60 * 1000))
    );

    const smsContent = L6_DAY0_SMS(customerName, currentPrice, futurePrice, hoursUntilIncrease);

    // SMS 로그 저장 (기존 CrmSmsLog 사용, 위에서 조회한 org 재사용)
    try {
      if (org) {
        await prisma.smsLog.create({
          data: {
            organizationId: org.id,
            phone: phoneNumber,
            contentPreview: smsContent.substring(0, 100),
            channel: "L6_LENS",
            status: "PENDING",
          },
        });
      }
    } catch (logErr) {
      logger.warn("[L6SmsTrigger] SMS 로그 저장 실패", { err: logErr });
    }

    // 실제 SMS 발송 (알리고)
    let smsSent = false;
    try {
      await sendSmsViaAligo(phoneNumber, smsContent.trim());
      smsSent = true;
      logger.info("[L6SmsTrigger] Day 0 SMS 발송 완료", { registrationId, phoneNumber });
    } catch (smsErr) {
      logger.warn("[L6SmsTrigger] SMS 발송 실패", {
        registrationId,
        error: smsErr instanceof Error ? smsErr.message : String(smsErr),
      });
    }

    // SMS 로그 상태 업데이트
    if (org) {
      try {
        await prisma.smsLog.updateMany({
          where: { organizationId: org.id, phone: phoneNumber, status: "PENDING" },
          data: { status: smsSent ? "SENT" : "FAILED" },
        });
      } catch (_) { /* 로그 업데이트 실패는 무시 */ }
    }

    return NextResponse.json({
      ok: true,
      smsSent,
    });
  } catch (err) {
    logger.error("[L6SmsTrigger] 에러", { err });
    return NextResponse.json(
      { ok: false, message: "요청 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}

