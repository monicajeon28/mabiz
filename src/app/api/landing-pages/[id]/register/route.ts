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

    // [WO-15] Honeypot: 봇이 website 필드를 채우면 조용히 성공 반환 (website만 사용)
    const honeypot = (body.website ?? '').toString();
    if (honeypot.trim()) {
      logger.warn('[LandingRegister] Honeypot 감지 — 봇 차단', { landingPageId });
      return NextResponse.json({ ok: true, funnelStarted: false });
    }

    // [WO-15] 시간 방어: 1.5초 미만 제출 = 자동화 봇
    const loadedAt = typeof body.loadedAt === 'number' ? body.loadedAt : null;
    if (loadedAt) {
      const elapsed = Date.now() - loadedAt;
      // elapsed <= 0: 미래 timestamp 조작 방어, elapsed < 1500: 초고속 봇 방어
      if (elapsed <= 0 || elapsed < 1500) {
        logger.warn('[LandingRegister] 시간 방어 감지', { elapsed });
        return NextResponse.json({ ok: true, funnelStarted: false });
      }
    }

    // 필수값 먼저 체크 (UTM 파싱보다 앞)
    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ ok: false, message: "이름과 전화번호는 필수입니다." }, { status: 400 });
    }

    // 전화번호 정규화 (11자리 + 10자리 케이스 모두 처리)
    const digits = phone.replace(/[^0-9]/g, "");
    const normalizedPhone = digits.length === 10
      ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3")
      : digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");

    // utm 파라미터 (필수값 검증 이후)
    const sp = new URL(req.url).searchParams;
    const utmSource   = body.utmSource   ?? sp.get('utm_source')   ?? null;
    const utmMedium   = body.utmMedium   ?? sp.get('utm_medium')   ?? null;
    const utmCampaign = body.utmCampaign ?? sp.get('utm_campaign') ?? null;

    // [WO-15] 전화번호 형식 검증 (정규화 이후 적용)
    const KR_PHONE_RE = /^01[016789]-\d{3,4}-\d{4}$/;
    if (!KR_PHONE_RE.test(normalizedPhone)) {
      return NextResponse.json({ ok: false, message: '올바른 전화번호를 입력해 주세요.' }, { status: 400 });
    }

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
