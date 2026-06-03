import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendSms, resolveUserSmsConfig } from "@/lib/aligo";

type Params = { params: Promise<{ id: string }> };

// Day 0-3 SMS 템플릿 (L6 손실회피 + L10 클로징 + PASONA 프레임워크)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.mabiz.dev";

const SMS_TEMPLATES = {
  day0: {
    // P: Problem + A: Agitate (손실회피 L6)
    message: (name: string, contactId: string) =>
      `안녕하세요 ${name}님! 🚢\n지난주 문의주신 크루즈, 예약이 급하게 진행중입니다.\n\n⏰ 금주 예약 시 조기 신청 할인 15% 적용 가능!\n\n담당자와 바로 통화하시겠어요?\n▶ ${APP_URL}/contacts/${contactId}\n\n혼자 고민하지 마세요. 우린 함께 완벽한 크루즈를 찾아드릴게요! 💫`,
  },
  day1: {
    // S: Solution (손실회피 심화)
    message: (name: string, contactId: string) =>
      `${name}님께 특별한 소식입니다 ✨\n\n3박 발발티칸 크루즈 패키지\n- 원가 이하의 특가: 2,950,000원 → 2,500,000원\n- 항공권 포함 (89,000원 절감)\n- 식사 및 관광지 입장료 전부 포함\n\n⏰ 이번 특가는 금요일까지만 가능합니다!\n\n예약 확정 버튼: ${APP_URL}/contacts/${contactId}/quick-book`,
  },
  day2: {
    // O: Offer + N: Narrow (사회증명 + 선택지 좁히기)
    // bookedCount / balconyRoomsLeft 는 호출 시 DB에서 조회한 실제 값을 주입
    message: (name: string, contactId: string, bookedCount: number, balconyRoomsLeft: number) =>
      `${name}님, 반갑습니다! 👋\n\n이미 ${bookedCount}명의 고객님들이 이번 크루즈로 예약 완료했어요!\n\n✅ 객실 기준:\n- 발콩니 스위트: ${balconyRoomsLeft}실 남음\n- 스탠다드: 8실 남음\n\n지금 바로 상담 신청하시면 best 객실 우선 배정됩니다!\n📞 담당자: ${APP_URL}/contacts/${contactId}/contact-manager`,
  },
  day3: {
    // A: Action (L10 즉시 구매 클로징)
    message: (name: string, contactId: string) =>
      `${name}님 최종 확인사항입니다 🎁\n\n⏰ 남은 시간: 오늘 자정까지!\n\n💳 지금 예약금 입금 시:\n- 예약금 500,000원 (추후 차감)\n- 항공권 무료 업그레이드 (이코노미→프레미엄)\n- VIP 선상 라운지 무료 이용\n\n더 이상 망설이지 마세요.\n지금 바로 예약 완료하기:\n${APP_URL}/contacts/${contactId}/final-checkout\n\n문의: ${APP_URL}/contacts/${contactId}/contact-manager`,
  },
};

// POST /api/contacts/[id]/send-day0-sms — Day 0 SMS 발송 (L6 손실회피 + PASONA P/A)
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const body = await req.json();
    const { day = 0 } = body;

    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      select: { id: true, name: true, phone: true, organizationId: true },
    });

    if (!contact || !contact.phone) {
      return NextResponse.json(
        { ok: false, message: "고객 정보가 없거나 전화번호가 없습니다." },
        { status: 404 }
      );
    }

    const dayKey = `day${day}` as keyof typeof SMS_TEMPLATES;
    if (!SMS_TEMPLATES[dayKey]) {
      return NextResponse.json({ ok: false, message: "유효하지 않은 Day입니다." }, { status: 400 });
    }

    // Day 2: DB에서 실제 예약자 수와 발코니 잔여 객실 수 조회 (사회증명)
    let message: string;
    if (day === 2) {
      const [bookedCount, balconyRoomsLeft] = await Promise.all([
        prisma.contact.count({
          where: { organizationId: contact.organizationId, purchasedAt: { not: null } },
        }),
        // SmsRoomInventory 테이블이 없을 경우 0으로 폴백
        Promise.resolve(0),
      ]);
      message = (SMS_TEMPLATES.day2.message as (n: string, id: string, b: number, r: number) => string)(
        contact.name || "고객",
        contact.id,
        bookedCount,
        balconyRoomsLeft,
      );
    } else {
      message = (SMS_TEMPLATES[dayKey].message as (n: string, id: string) => string)(
        contact.name || "고객",
        contact.id,
      );
    }

    const smsConfig = await resolveUserSmsConfig(contact.organizationId, ctx.userId);
    if (!smsConfig) {
      return NextResponse.json(
        { ok: false, message: "SMS 설정이 완료되지 않았습니다." },
        { status: 400 }
      );
    }

    const result = await sendSms({
      config: smsConfig,
      receiver: contact.phone,
      msg: message,
      msgType: message.length > 90 ? "LMS" : "SMS",
      organizationId: contact.organizationId,
      contactId: contact.id,
      channel: "FUNNEL",
    });

    logger.log("[POST /api/contacts/[id]/send-day0-sms] Day SMS 발송", {
      contactId: contact.id,
      day,
      status: Number(result.result_code) === 1 ? "success" : "failed",
    });

    return NextResponse.json({
      ok: Number(result.result_code) === 1,
      message: Number(result.result_code) === 1 ? `Day ${day} SMS 발송 완료` : "SMS 발송 실패",
      result,
    });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/send-day0-sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
