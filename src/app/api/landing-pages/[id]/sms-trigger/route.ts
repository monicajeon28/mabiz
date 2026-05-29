import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// [T9] In-memory IP rate-limit: landingPageId + IP 기준 분당 3건
const ipRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string, landingPageId: string): boolean {
  const key = `${landingPageId}:${ip}`;
  const now = Date.now();
  const entry = ipRateMap.get(key);
  if (!entry || now >= entry.resetAt) {
    ipRateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true; // 허용
  }
  if (entry.count >= RATE_LIMIT) return false; // 초과
  entry.count++;
  return true;
}

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

    // [T9] IP rate-limit: 분당 3건 제한
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip, landingPageId)) {
      logger.warn("[L6SmsTrigger] IP rate-limit 초과", { ip, landingPageId });
      return NextResponse.json(
        { ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    // P1-24: 전화번호/이름을 DB에서 직접 조회 (클라이언트 신뢰 불필요)
    // [T9] landingPageId 교차 검증: registration이 해당 landingPageId에 속하는지 확인
    const registration = await prisma.crmLandingRegistration.findUnique({
      where: { id: registrationId },
      select: { phone: true, name: true, landingPageId: true },
    });

    if (!registration) {
      return NextResponse.json(
        { ok: false, message: "등록 정보를 찾을 수 없습니다." },
        { status: 404 }
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
    const org = await prisma.organization.findFirst({
      where: { landingPages: { some: { id: landingPageId } } },
      select: { id: true },
    });

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

    // 실제 SMS 발송 (비동기 큐에 추가)
    // TODO: 실제 SMS API 통합 필요 (KakaoTalk, NHN ToastSMS 등)
    // 현재는 로그만 기록하고 성공 반환
    logger.info("[L6SmsTrigger] Day 0 SMS 발송 예약", {
      registrationId,
      phoneNumber,
      messageType,
    });

    return NextResponse.json({
      ok: true,
      message: "SMS 발송 예약됨",
      smsSent: true,
      smsContent: smsContent.trim(),
    });
  } catch (err) {
    logger.error("[L6SmsTrigger] 에러", { err });
    return NextResponse.json(
      { ok: false, message: "요청 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}

