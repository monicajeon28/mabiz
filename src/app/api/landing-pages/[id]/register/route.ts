import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { triggerGroupFunnelSms } from "@/lib/funnel-sms-trigger";
import { shouldResetOnReentry } from "@/lib/funnel-sms-helpers";
import { logger } from "@/lib/logger";
import { addLeadScore } from "@/lib/lead-score";
import { normalizePhone } from "@/lib/phone-normalize";
import { sendFunnelEmail } from "@/lib/email";
import sanitizeHtml from "sanitize-html";
import { replaceMessagePlaceholders } from "@/lib/message-replacements";

type FormConfig = {
  b2bEduType?: "INQUIRER" | "BUYER";
  additionalFields?: { id: string; name: string; required: boolean }[];
};

type Params = { params: Promise<{ id: string }> };

// POST /api/landing-pages/[id]/register
// 공개 엔드포인트 — 인증 불필요 (랜딩페이지 신청 폼)
export async function POST(req: Request, { params }: Params) {
  try {
    const { id: landingPageId } = await params;
    const body = await req.json();
    const { name, phone, email, metadata } = body;

    // [P1-6] formConfig JSON 유효성 검증 (body에 있으면 검증)
    if (body.formConfig) {
      try {
        JSON.parse(JSON.stringify(body.formConfig)); // 직렬화 가능 확인
      } catch {
        return NextResponse.json({ ok: false, message: "formConfig가 유효한 JSON이 아닙니다." }, { status: 400 });
      }
    }

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

    // [P1-6] 결제 필드 검증: paymentEnabled=true면 paymentType/productPrice 필수
    if (body.paymentEnabled === true) {
      const paymentType = body.paymentType?.trim();
      const productPrice = body.productPrice;
      if (!paymentType || typeof productPrice !== 'number' || productPrice <= 0) {
        return NextResponse.json({ ok: false, message: "결제 활성화 시 결제유형과 상품가격(양수)은 필수입니다." }, { status: 400 });
      }
    }

    // 전화번호 정규화 (공통 유틸 사용)
    const normalizedPhone = normalizePhone(phone);

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
      select: {
        id: true, organizationId: true, groupId: true, autoFunnelId: true, title: true,
        regEmailEnabled: true, regEmailSubject: true, regEmailContent: true,
        formConfig: true,
        smsL6Day0Enabled: true,
        createdByUserId: true,
      },
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

      // 리드 스코어 +30 (랜딩 등록 = 강력한 관심 신호)
      addLeadScore(contact.id, "LANDING_REGISTER").catch(() => {});

      // B2B 문의자/구매자 자동 등록
      const fc = landingPage.formConfig as FormConfig | null;
      if (fc?.b2bEduType) {
        const additionalFieldsMap = new Map(
          (fc.additionalFields ?? []).map((f) => [`custom_${f.id}`, f.name])
        );
        const customFields = (metadata as Record<string, unknown>)?.customFields as Record<string, string> | undefined;
        const notesLines: string[] = [`[랜딩 신청: ${landingPage.title}]`];
        if (customFields) {
          for (const [key, val] of Object.entries(customFields)) {
            const label = additionalFieldsMap.get(key) ?? key;
            notesLines.push(`${label}: ${val}`);
          }
        }
        const notesText = notesLines.join('\n');

        const existingProspect = await prisma.b2BProspect.findFirst({
          where: { phone: normalizedPhone, organizationId: orgId },
          select: { id: true },
        });
        if (existingProspect) {
          await prisma.b2BProspect.update({
            where: { id: existingProspect.id },
            data: { notes: notesText },
          });
        } else {
          await prisma.b2BProspect.create({
            data: {
              organizationId: orgId,
              name,
              phone: normalizedPhone,
              email: email ?? null,
              eduType: fc.b2bEduType,
              notes: notesText,
              status: '잠재고객',
            },
          });
        }
      }

      // autoFunnelId 직접 퍼널 시작 (그룹 경유 없이)
      if (!funnelStarted && landingPage.autoFunnelId) {
        // P0-10: UUID 형식 검증 (path traversal 방지)
        if (!/^[a-f0-9\-]{36}$/.test(landingPage.autoFunnelId)) {
          logger.error('[LandingRegister] 잘못된 autoFunnelId 형식', { autoFunnelId: landingPage.autoFunnelId });
        } else {
          try {
            const enrollRes = await fetch(new URL(`/api/funnels/${landingPage.autoFunnelId}/enroll`, req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId: contact.id, sendNow: false }),
          });
          const enrollData = await enrollRes.json();
          if (enrollData.ok) {
            funnelStarted = true;
            prisma.crmLandingRegistration.update({
              where: { id: regId },
              data: { funnelStarted: true },
            }).catch(() => {});
          }
          } catch { /* 퍼널 시작 실패해도 등록은 유지 */ }
        }
      }

      // 그룹 배정 + 퍼널 시작
      if (landingPage.groupId) {
        // 재유입 정책 조회: RESET 계열이면 addedAt=now 갱신 → 퍼널문자 0일차부터 재시작.
        //  (랜딩 재신청이 대표적 재유입 경로). KEEP(기본)이면 최초 입력일 유지.
        const grp = await prisma.contactGroup.findUnique({
          where: { id: landingPage.groupId },
          select: { reEntryPolicy: true },
        });
        const member = await prisma.contactGroupMember.upsert({
          where: {
            groupId_contactId: { groupId: landingPage.groupId, contactId: contact.id },
          },
          create: { groupId: landingPage.groupId, contactId: contact.id },
          update: shouldResetOnReentry(grp?.reEntryPolicy) ? { addedAt: new Date() } : {},
          select: { addedAt: true },
        });

        const triggered = await triggerGroupFunnel({
          contactId:      contact.id,
          groupId:        landingPage.groupId,
          organizationId: orgId,
        });

        // ★ 퍼널문자(FunnelSms) 트리거 — 그룹에 funnelSmsId가 연결된 경우
        // fire-and-forget: 실패해도 신청 등록은 유지
        const smsTriggered = await triggerGroupFunnelSms({
          contactId:      contact.id,
          groupId:        landingPage.groupId,
          organizationId: orgId,
          // 발송 기준일 = 고객이 그룹에 들어온 날(최초 입력일).
          anchorDate:     member.addedAt,
        }).catch((err) => {
          logger.error('[LandingRegister] 퍼널문자 트리거 실패', { err });
          return false;
        });

        // [T8] OR 연산으로 true 상태 유지 (autoFunnelId + groupId 동시 사용 시 오염 방지)
        funnelStarted = funnelStarted || triggered || smsTriggered;

        // funnelStarted 업데이트 (fire-and-forget)
        if (triggered || smsTriggered) {
          // id로 특정 행만 업데이트 (updateMany 다중 행 방지)
          prisma.crmLandingRegistration.update({
            where: { id: regId },
            data:  { funnelStarted: true },
          }).catch(() => {});
        }
      }
    }

    // [T12] Day 0 SMS 즉시 예약 (smsL6Day0Enabled ON + orgId + contact 존재 시)
    if (orgId && landingPage.smsL6Day0Enabled) {
      const smsContact = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, organizationId: orgId },
        select: { id: true, optOutAt: true },
      });
      if (smsContact && !smsContact.optOutAt) {
        // [T14] opt-out 고객은 Day 0 SMS도 건너뜀
        const defaultMsg = `${name}님, 신청해 주셔서 감사합니다. 곧 담당자가 안내해 드리겠습니다.`;
        prisma.scheduledSms.create({
          data: {
            organizationId: orgId,
            contactId: smsContact.id,
            message: defaultMsg,
            scheduledAt: new Date(), // 즉시 발송
            status: "PENDING",
            channel: "L6_DAY0",
            // 랜딩 소유자 계정으로 발송 → BatchSender가 작성자별 개인 알리고 해석
            createdByUserId: landingPage.createdByUserId ?? null,
          },
        }).catch((e) => logger.warn("[LandingRegister] Day 0 SMS 예약 실패", { err: e }));
      } else if (smsContact?.optOutAt) {
        logger.info("[LandingRegister] 수신 거부 고객 — Day 0 SMS 건너뜀", { phone: normalizedPhone.substring(0, 4) + "***" });
      }
    }

    // 신청 완료 이메일 자동 발송 (설정 ON + 이메일 주소 있을 때만)
    if (landingPage.regEmailEnabled && email && landingPage.regEmailSubject) {
      const subject = replaceMessagePlaceholders(landingPage.regEmailSubject, { name });
      const rawContent = replaceMessagePlaceholders(
        landingPage.regEmailContent || `${name}님, 신청이 완료되었습니다.`,
        { name }
      );

      // [T11] XSS 방지: sendFunnelEmail 호출 전 HTML sanitize
      const unsafeHtml = rawContent.includes("<")
        ? rawContent
        : `<div style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap">${rawContent}</div>`;
      // [P0-XSS] 인라인 style 전역 허용 제거 — CSS 기반 XSS(position/expression 등) 차단.
      // class만 유지하고 style은 안전한 표현 wrapper(div)에만 우리가 직접 부여한다.
      const htmlContent = sanitizeHtml(unsafeHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "br"]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          "*": ["class"],
        },
        allowedSchemes: ["http", "https", "mailto"],
        allowProtocolRelative: false,
      });

      sendFunnelEmail({
        organizationId: orgId,
        to:      email,
        subject,
        html:    htmlContent,
        channel: "MANUAL",
      }).catch(() => {}); // fire-and-forget: 이메일 실패해도 신청은 유지
    }

    logger.log("[LandingRegister] 등록 완료", {
      phone:        normalizedPhone.substring(0, 4) + "***",
      funnelStarted,
      emailSent: !!(landingPage.regEmailEnabled && email),
    });

    // [P2] contactId 응답 제거 (IDOR 탐색 방지)
    // L6 SMS 트리거용 registrationId 추가
    return NextResponse.json({ ok: true, funnelStarted, registrationId: regId });

  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/register]", { err });
    return NextResponse.json({ ok: false, message: "등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
