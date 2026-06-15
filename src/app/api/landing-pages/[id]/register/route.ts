import { NextResponse } from "next/server";
import { z } from "zod";
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
import { scheduleDay0To3Sms } from "@/lib/landing-page-sms-scheduler";

// [P1-11] FormConfig Zod 검증 스키마
const FormConfigSchema = z.object({
  b2bEduType: z.enum(["INQUIRER", "BUYER"]).optional(),
  additionalFields: z.array(z.object({
    id: z.string(),
    name: z.string(),
    required: z.boolean(),
  })).optional(),
}).strict();

type FormConfig = z.infer<typeof FormConfigSchema>;

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

    // 랜딩페이지 조회 (groupId + expireDate 포함)
    const landingPage = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, isActive: true },
      select: {
        id: true, organizationId: true, groupId: true, autoFunnelId: true, title: true,
        regEmailEnabled: true, regEmailSubject: true, regEmailContent: true,
        formConfig: true,
        smsL6Day0Enabled: true,
        createdByUserId: true,
        expireDate: true,
        pageFormat: true,
      },
    });
    if (!landingPage) {
      return NextResponse.json({ ok: false, message: "페이지를 찾을 수 없습니다." }, { status: 404 });
    }

    // [P1-11] FormConfig JSON 타입 검증 (Zod 기반)
    let parsedFormConfig: FormConfig | null = null;
    if (landingPage.formConfig) {
      try {
        const rawConfig = typeof landingPage.formConfig === 'string'
          ? JSON.parse(landingPage.formConfig)
          : landingPage.formConfig;
        parsedFormConfig = FormConfigSchema.parse(rawConfig);
      } catch (err) {
        logger.warn("[LandingRegister] FormConfig 검증 실패 (스킵)", {
          error: err instanceof Error ? err.message : String(err),
        });
        // 검증 실패해도 신청은 계속 진행 (formConfig는 선택사항)
      }
    }

    // [P0-5] 마감일 검증: 현재 시간이 expireDate를 지났으면 마감됨
    if (landingPage.expireDate && new Date() > new Date(landingPage.expireDate)) {
      return NextResponse.json(
        { ok: false, message: "마감된 퍼널입니다. 이전 오퍼를 확인해주세요." },
        { status: 410 }
      ); // 410 Gone: 리소스가 더 이상 사용 불가
    }

    const orgId = landingPage.organizationId;

    // [T1-수신거부검증] 그룹 설정되어 있으면 수신거부 고객 DB에서 검증
    if (orgId && landingPage.groupId) {
      const unsubscribedContact = await prisma.contact.findUnique({
        where: {
          phone_organizationId: { phone: normalizedPhone, organizationId: orgId },
        },
        select: { optOutAt: true },
      });

      if (unsubscribedContact?.optOutAt) {
        logger.warn('[LandingPageRegister] 수신거부 고객 신청 시도', {
          phone: normalizedPhone.substring(0, 4) + "***",
          landingPageId,
          organizationId: orgId,
        });

        return NextResponse.json(
          {
            ok: false,
            error: '이미 수신거부된 번호입니다.',
            code: 'UNSUBSCRIBED',
            message: '거부를 취소하려면 고객센터로 연락주세요.',
          },
          { status: 403 }
        );
      }
    }

    // 퍼널 시작 여부 (나중에 기록)
    let funnelStarted = false;

    // 신청 기록 저장 (unique constraint로 race condition 방어)
    let regId: string = '';
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

    // ★ 핵심: Contact + GroupMember 트랜잭션 보호 (Race Condition 방지)
    if (orgId) {
      let contact: { id: string };
      let member: { addedAt: Date } | null = null;
      let isNewContact = false; // [P1-10] 신규 Contact 여부 추적

      try {
        // P0-3: Serializable 레벨 트랜잭션으로 Contact + GroupMember 원자성 보장
        const txResult = await prisma.$transaction(
          async (tx) => {
            // Step 1: Contact upsert (원자적)
            // [P1-10] 기존 Contact 존재 여부 먼저 체크
            const existingContact = await tx.contact.findUnique({
              where: {
                phone_organizationId: { phone: normalizedPhone, organizationId: orgId },
              },
              select: { id: true, signupCount: true, signupHistory: true },
            });

            const contact = await tx.contact.upsert({
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
                // [P1-10] 신규 Contact 생성 시 signupCount = 1 (기본값)
                signupCount: 1,
                signupHistory: JSON.stringify([{
                  index: 1,
                  landingPageId,
                  landingPageTitle: landingPage.title,
                  groupId: landingPage.groupId || null,
                  groupName: null,
                  createdAt: new Date().toISOString(),
                  email: email ?? null,
                  phone: normalizedPhone,
                }]),
              },
              update: {
                name,
                email: email ?? undefined,
                // [P1-10] 기존 Contact 갱신 시 signupCount 증가
                signupCount: existingContact ? existingContact.signupCount + 1 : 1,
                // [P1-10] signupHistory JSON 배열에 신청 기록 추가
                signupHistory: existingContact?.signupHistory
                  ? (() => {
                      try {
                        const history = Array.isArray(existingContact.signupHistory)
                          ? existingContact.signupHistory
                          : JSON.parse(existingContact.signupHistory as string);
                        const newEntry = {
                          index: (history?.length || 0) + 1,
                          landingPageId,
                          landingPageTitle: landingPage.title,
                          groupId: landingPage.groupId || null,
                          groupName: null,
                          createdAt: new Date().toISOString(),
                          email: email ?? null,
                          phone: normalizedPhone,
                        };
                        return JSON.stringify([...history, newEntry]);
                      } catch {
                        // JSON 파싱 실패 시 새로 시작
                        return JSON.stringify([{
                          index: (existingContact.signupCount || 0) + 1,
                          landingPageId,
                          landingPageTitle: landingPage.title,
                          groupId: landingPage.groupId || null,
                          groupName: null,
                          createdAt: new Date().toISOString(),
                          email: email ?? null,
                          phone: normalizedPhone,
                        }]);
                      }
                    })()
                  : JSON.stringify([{
                      index: (existingContact?.signupCount || 0) + 1,
                      landingPageId,
                      landingPageTitle: landingPage.title,
                      groupId: landingPage.groupId || null,
                      groupName: null,
                      createdAt: new Date().toISOString(),
                      email: email ?? null,
                      phone: normalizedPhone,
                    }]),
              },
            });

            isNewContact = !existingContact; // [P1-10] 신규 여부 기록

            // Step 2: 그룹 배정 (있으면) — Contact 결정 후 수행
            // [P1-9] groupId는 UUID ID만 사용 (문자열 category/subName 혼동 방지)
            let groupMember: { addedAt: Date } | null = null;
            if (landingPage.groupId && typeof landingPage.groupId === 'string' && /^[a-f0-9\-]{36}$/.test(landingPage.groupId)) {
              const grp = await tx.contactGroup.findUnique({
                where: { id: landingPage.groupId },
                select: { reEntryPolicy: true },
              });
              groupMember = await tx.contactGroupMember.upsert({
                where: {
                  groupId_contactId: { groupId: landingPage.groupId, contactId: contact.id },
                },
                create: { groupId: landingPage.groupId, contactId: contact.id },
                update: shouldResetOnReentry(grp?.reEntryPolicy) ? { addedAt: new Date() } : {},
                select: { addedAt: true },
              });
            }

            return { contact, groupMember };
          },
          {
            isolationLevel: "Serializable", // ← Race Condition 완전 방지
            timeout: 10000, // ← 10초 타임아웃
          }
        );

        contact = txResult.contact;
        member = txResult.groupMember;
      } catch (txError) {
        // [P1-13] 타임아웃 에러 처리 개선
        const isTimeout = txError instanceof Error && (
          txError.message.includes('timeout') ||
          txError.message.includes('P2028') ||
          (txError as any).code === 'P2028'
        );

        logger.error("[LandingRegister] 트랜잭션 실패 (Contact + GroupMember)", {
          error: txError instanceof Error ? txError.message : String(txError),
          phone: normalizedPhone.substring(0, 4) + "***",
          isTimeout,
        });

        // Contact 생성 실패 시에도 등록 기록은 유지 (이미 생성됨)
        return NextResponse.json(
          {
            ok: false,
            message: isTimeout
              ? "처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
              : "등록 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
          },
          { status: isTimeout ? 408 : 500 }
        );
      }

      // [P1-12] 비블로킹 작업들을 Promise.allSettled로 묶기 (실패 감지)
      const backgroundTasks = [
        // 리드 스코어 +30 (랜딩 등록 = 강력한 관심 신호)
        addLeadScore(contact.id, "LANDING_REGISTER").catch(() => {}),
      ];

      // B2B 문의자/구매자 자동 등록 (트랜잭션 외부, 비블로킹)
      if (parsedFormConfig?.b2bEduType && (parsedFormConfig.b2bEduType === "INQUIRER" || parsedFormConfig.b2bEduType === "BUYER")) {
        const additionalFieldsMap = new Map(
          (parsedFormConfig.additionalFields ?? []).map((f) => [`custom_${f.id}`, f.name])
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
        const b2bEduType = parsedFormConfig.b2bEduType; // 타입 좁히기

        backgroundTasks.push(
          prisma.b2BProspect.findFirst({
            where: { phone: normalizedPhone, organizationId: orgId },
            select: { id: true },
          }).then(async (existingProspect) => {
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
                  eduType: b2bEduType,
                  notes: notesText,
                  status: '잠재고객',
                },
              });
            }
          }).catch((err) => {
            logger.warn("[LandingRegister] B2B 문의자 등록 실패", { err });
            throw err; // Promise.allSettled에서 catch할 수 있게
          })
        );
      }

      // [P1-12] 모든 비블로킹 작업 동시 실행 + 실패 감지
      const results = await Promise.allSettled(backgroundTasks);
      const failedTasks = results.filter(r => r.status === 'rejected');
      if (failedTasks.length > 0) {
        logger.warn("[LandingRegister] 일부 비블로킹 작업 실패 (신청은 유지)", {
          failedCount: failedTasks.length,
          totalCount: results.length,
        });
      }

      // autoFunnelId 직접 퍼널 시작 (그룹 경유 없이)
      // [P1-9] autoFunnelId는 UUID 형식만 허용 (경로 통과 방지)
      if (!funnelStarted && landingPage.autoFunnelId && typeof landingPage.autoFunnelId === "string") {
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

      // 퍼널 시작 (비블로킹)
      if (landingPage.groupId && typeof landingPage.groupId === "string" && member && contact) {
        // 트랜잭션 이후: 퍼널 트리거는 비블로킹으로 진행
        // contact.id와 member.addedAt은 트랜잭션으로 보장됨
        const groupId = landingPage.groupId; // 클로저에서 사용할 수 있게 캡처
        const contactId = contact.id; // 클로저에서 사용할 수 있게 캡처
        const anchorDate = member.addedAt; // 클로저에서 사용할 수 있게 캡처
        triggerGroupFunnel({
          contactId:      contactId,
          groupId:        groupId,
          organizationId: orgId,
        }).then(async (triggered) => {
          // ★ 퍼널문자(FunnelSms) 트리거 — 그룹에 funnelSmsId가 연결된 경우
          // fire-and-forget: 실패해도 신청 등록은 유지
          const smsTriggered = await triggerGroupFunnelSms({
            contactId:      contactId,
            groupId:        groupId,
            organizationId: orgId,
            // 발송 기준일 = 고객이 그룹에 들어온 날(최초 입력일).
            anchorDate:     anchorDate,
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
        }).catch((err) => {
          logger.error('[LandingRegister] 퍼널 트리거 실패', { err });
        });
      }
    }

    // [P0-2] Day 0-3 SMS 자동 예약 (smsL6Day0Enabled ON + orgId + contact 존재 시)
    // PASONA 프레임워크 기반 4일간 자동 시퀀스
    if (orgId && landingPage.smsL6Day0Enabled) {
      const smsContact = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, organizationId: orgId },
        select: { id: true, optOutAt: true, lensMetadata: true },
      });
      if (smsContact && !smsContact.optOutAt) {
        // [T14] opt-out 고객은 Day 0 SMS도 건너뜀
        // 렌즈 감지: lensMetadata에서 lens 추출 (없으면 L0 기본값)
        let lensType: 'L0' | 'L1' | 'L2' | 'L3' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10' = 'L0';
        if (smsContact.lensMetadata && typeof smsContact.lensMetadata === 'object') {
          const metadata = smsContact.lensMetadata as any;
          if (metadata.lens && ['L0', 'L1', 'L2', 'L3', 'L6', 'L7', 'L8', 'L9', 'L10'].includes(metadata.lens)) {
            lensType = metadata.lens;
          }
        }

        const scheduleResult = await scheduleDay0To3Sms({
          organizationId: orgId,
          contactId: smsContact.id,
          contactPhone: normalizedPhone,
          pageFormat: landingPage.pageFormat || "hybrid",
          pageTitle: landingPage.title,
          createdByUserId: landingPage.createdByUserId,
          
        });

        if (scheduleResult.success) {
          logger.log("[LandingRegister] Day 0-3 SMS 예약 완료", {
            phone: normalizedPhone.substring(0, 4) + "***",
            scheduled: scheduleResult.scheduled,
          });
        } else {
          logger.warn("[LandingRegister] Day 0-3 SMS 예약 부분 실패", {
            scheduled: scheduleResult.scheduled,
            error: scheduleResult.error,
          });
        }
      } else if (smsContact?.optOutAt) {
        logger.info("[LandingRegister] 수신 거부 고객 — Day 0-3 SMS 건너뜀", {
          phone: normalizedPhone.substring(0, 4) + "***",
        });
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
