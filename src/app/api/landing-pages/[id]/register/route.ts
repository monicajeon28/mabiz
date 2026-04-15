import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// POST /api/landing-pages/[id]/register
// 공개 엔드포인트 — 인증 불필요 (랜딩페이지 신청 폼)
export async function POST(req: Request, { params }: Params) {
  try {
    const { id: landingPageId } = await params;
    const body = await req.json();
    const { name, phone, email, metadata } = body;
    // utm 파라미터: body 우선, 없으면 URL query에서 폴백 (양쪽 지원)
    const sp = new URL(req.url).searchParams;
    const utmSource   = body.utmSource   ?? sp.get('utm_source')   ?? null;
    const utmMedium   = body.utmMedium   ?? sp.get('utm_medium')   ?? null;
    const utmCampaign = body.utmCampaign ?? sp.get('utm_campaign') ?? null;

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ ok: false, message: "이름과 전화번호는 필수입니다." }, { status: 400 });
    }

    // 전화번호 정규화
    const normalizedPhone = phone.replace(/[^0-9]/g, "")
      .replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");

    // 랜딩페이지 조회 (groupId 포함)
    const landingPage = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, isActive: true },
      select: { id: true, organizationId: true, groupId: true, title: true },
    });
    if (!landingPage) {
      return NextResponse.json({ ok: false, message: "페이지를 찾을 수 없습니다." }, { status: 404 });
    }

    const orgId = landingPage.organizationId;

    // 퍼널 시작 여부 (나중에 기록)
    let funnelStarted = false;

    // 신청 기록 저장 (unique constraint로 race condition 방어)
    let regId: string;
    try {
      const reg = await prisma.crmLandingRegistration.create({
        data: {
          landingPageId,
          name,
          phone:       normalizedPhone,
          email:       email       ?? null,
          utmSource:   utmSource   ?? null,
          utmMedium:   utmMedium   ?? null,
          utmCampaign: utmCampaign ?? null,
          metadata:    metadata    ?? undefined,
          funnelStarted: false,
        },
        select: { id: true },
      });
      regId = reg.id;
    } catch (e: unknown) {
      // unique constraint 위반 = 중복 등록
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Unique constraint') || msg.includes('P2002')) {
        return NextResponse.json({ ok: true, isDuplicate: true });
      }
      throw e;
    }

    // ★ 핵심: Contact upsert → 그룹 자동 배정 → 퍼널 자동 시작
    if (orgId) {
      const contact = await prisma.contact.upsert({
        where: {
          phone_organizationId: { phone: normalizedPhone, organizationId: orgId },
        },
        create: {
          organizationId: orgId,
          name,
          phone:     normalizedPhone,
          email:     email ?? null,
          type:      "LEAD",
          utmSource: utmSource ?? null,
          adminMemo: `랜딩페이지 신청 from: "${landingPage.title}"`,
        },
        update: {
          name,
          email: email ?? undefined,
        },
      });

      // 그룹 배정 + 퍼널 시작
      if (landingPage.groupId) {
        await prisma.contactGroupMember.upsert({
          where: {
            groupId_contactId: { groupId: landingPage.groupId, contactId: contact.id },
          },
          create: { groupId: landingPage.groupId, contactId: contact.id },
          update: {},
        });

        const triggered = await triggerGroupFunnel({
          contactId:      contact.id,
          groupId:        landingPage.groupId,
          organizationId: orgId,
          sendFirst:      true,
        });

        funnelStarted = triggered;

        // funnelStarted 업데이트 (fire-and-forget)
        if (triggered) {
          // id로 특정 행만 업데이트 (updateMany 다중 행 방지)
          prisma.crmLandingRegistration.update({
            where: { id: regId },
            data:  { funnelStarted: true },
          }).catch(() => {});
        }
      }
    }

    logger.log("[LandingRegister] 등록 완료", {
      phone:        normalizedPhone.substring(0, 4) + "***",
      funnelStarted,
    });

    // [P2] contactId 응답 제거 (IDOR 탐색 방지)
    return NextResponse.json({ ok: true, funnelStarted });

  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/register]", { err });
    return NextResponse.json({ ok: false, message: "등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
