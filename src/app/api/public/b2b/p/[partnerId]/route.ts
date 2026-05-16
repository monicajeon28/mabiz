import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkBotGuard } from '@/lib/bot-guard';
import { checkOrigin } from '@/lib/origin-guard';
import { addLeadScore } from '@/lib/lead-score';
import { triggerGroupFunnel } from '@/lib/funnel-trigger';

type Params = { params: Promise<{ partnerId: string }> };

// ── 헬퍼: partnerId로 조직 찾기 ──
async function resolveOrganization(partnerId: string) {
  const num = Number(partnerId);

  // 1) externalAffiliateProfileId (숫자)
  if (!isNaN(num)) {
    const org = await prisma.organization.findFirst({
      where: { externalAffiliateProfileId: num, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true, externalAffiliateProfileId: true },
    });
    if (org) return org;
  }

  // 2) slug
  const orgBySlug = await prisma.organization.findFirst({
    where: { slug: partnerId, status: 'ACTIVE' },
    select: { id: true, name: true, slug: true, externalAffiliateProfileId: true },
  });
  if (orgBySlug) return orgBySlug;

  // 3) 폴백: DEFAULT_ORGANIZATION_ID
  const defaultId = process.env.DEFAULT_ORGANIZATION_ID;
  if (defaultId) {
    return prisma.organization.findUnique({
      where: { id: defaultId },
      select: { id: true, name: true, slug: true, externalAffiliateProfileId: true },
    });
  }

  return null;
}

/**
 * GET /api/public/b2b/p/[partnerId]?info=1
 * 파트너 정보 + B2B 랜딩 데이터 조회 (공개)
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { partnerId } = await params;
    const { searchParams } = new URL(req.url);
    const org = await resolveOrganization(partnerId);
    if (!org) {
      return NextResponse.json({ ok: false, message: '파트너를 찾을 수 없습니다.' }, { status: 404 });
    }

    const affiliateCode = org.externalAffiliateProfileId
      ? String(org.externalAffiliateProfileId) : null;

    // B2B 랜딩페이지 조회 (파트너별 → 글로벌 폴백)
    let landingPage = await prisma.b2BLandingPage.findFirst({
      where: { organizationId: org.id, partnerId, isActive: true },
      include: {
        comments: { where: { landingPageId: { not: undefined } }, orderBy: { createdAt: 'desc' } },
        images: { orderBy: { sortOrder: 'asc' }, include: { imageAsset: { select: { driveFileId: true, width: true, height: true, mimeType: true } } } },
      },
    });

    if (!landingPage) {
      // 글로벌 페이지 폴백
      landingPage = await prisma.b2BLandingPage.findFirst({
        where: { organizationId: org.id, partnerId: null, isActive: true },
        include: {
          comments: { orderBy: { createdAt: 'desc' } },
          images: { orderBy: { sortOrder: 'asc' }, include: { imageAsset: { select: { driveFileId: true, width: true, height: true, mimeType: true } } } },
        },
      });
    }

    // viewCount 증가 (fire-and-forget)
    if (landingPage && !searchParams.get('preview')) {
      prisma.b2BLandingPage.update({
        where: { id: landingPage.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      partner: { name: org.name, affiliateCode },
      landingPage: landingPage ? {
        id: landingPage.id,
        title: landingPage.title,
        htmlContent: landingPage.htmlContent,
        editorMode: landingPage.editorMode,
        formConfig: landingPage.formConfig,
        buttonTitle: landingPage.buttonTitle,
        paymentEnabled: landingPage.paymentEnabled,
        paymentType: landingPage.paymentType,
        productName: landingPage.productName,
        productPrice: landingPage.productPrice,
        commentEnabled: landingPage.commentEnabled,
        comments: landingPage.comments,
        images: landingPage.images,
        exposureTitle: landingPage.exposureTitle,
        exposureImage: landingPage.exposureImage,
        footerText: landingPage.footerText,
        completionPageUrl: landingPage.completionPageUrl,
      } : null,
    });
  } catch (err) {
    logger.error('[GET /api/public/b2b/p/[partnerId]]', { err });
    return NextResponse.json({ ok: false, message: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/public/b2b/p/[partnerId]
 * B2B 리드 등록 + CRM 고객 자동생성 + 리드점수 + 퍼널 자동시작
 */
export async function POST(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, 'B2BPartnerLead')) {
      return NextResponse.json({ ok: false, message: '허용되지 않은 요청입니다.' }, { status: 403 });
    }

    const { partnerId } = await params;
    const org = await resolveOrganization(partnerId);
    if (!org) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 파트너 링크입니다.' }, { status: 404 });
    }

    // ── 바디 파싱 ──
    const body = await req.json() as {
      name?: string;
      phone?: string;
      email?: string;
      company?: string;
      packageInterest?: string;
      metadata?: Record<string, unknown>;
      landingPageId?: string;
      // UTM
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      // 봇 가드
      website?: string;
      hp?: string;
      loadedAt?: number;
    };

    // 봇 체크
    if (!checkBotGuard(body as Record<string, unknown>, 'B2BPartnerLead')) {
      return NextResponse.json({ ok: true });
    }

    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ ok: false, message: '이름과 전화번호는 필수입니다.' }, { status: 400 });
    }

    const normalizedPhone = body.phone.replace(/[^0-9]/g, '');
    if (normalizedPhone.length < 10) {
      return NextResponse.json({ ok: false, message: '올바른 연락처를 입력해주세요.' }, { status: 400 });
    }

    const formattedPhone = normalizedPhone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');

    // ── B2BLandingRegistration 중복 체크 ──
    if (body.landingPageId) {
      const existingReg = await prisma.b2BLandingRegistration.findUnique({
        where: { landingPageId_phone: { landingPageId: body.landingPageId, phone: formattedPhone } },
      });
      if (existingReg) {
        return NextResponse.json({
          ok: true,
          message: '이미 신청이 접수되었습니다. 담당자가 곧 연락드리겠습니다.',
          duplicate: true,
        });
      }
    }

    // ── B2BProspect 중복 체크 (48시간) ──
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const duplicateProspect = await prisma.b2BProspect.findFirst({
      where: {
        phone: formattedPhone,
        organizationId: org.id,
        createdAt: { gte: fortyEightHoursAgo },
      },
      select: { id: true },
    });

    if (duplicateProspect) {
      return NextResponse.json({
        ok: true,
        message: '이미 신청이 접수되었습니다.',
        duplicate: true,
      });
    }

    // ── OWNER 멤버 ──
    const ownerMember = await prisma.organizationMember.findFirst({
      where: { organizationId: org.id, role: 'OWNER', isActive: true },
      select: { userId: true },
    });

    const affiliateCode = org.externalAffiliateProfileId
      ? String(org.externalAffiliateProfileId) : null;

    // ── 1) B2BProspect 생성 ──
    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId:  org.id,
        name:            body.name.trim(),
        phone:           formattedPhone,
        email:           body.email?.trim() || null,
        companyName:     body.company?.trim() || null,
        packageInterest: body.packageInterest || null,
        source:          'B2B_PARTNER',
        status:          'NEW',
        assignedUserId:  ownerMember?.userId || null,
        affiliateCode,
        notes:           `파트너 B2B 랜딩 유입 (partnerId: ${partnerId})`,
      },
      select: { id: true },
    });

    // ── 2) CRM Contact 자동 생성/업데이트 ──
    let contactId: string | null = null;
    try {
      const contact = await prisma.contact.upsert({
        where: {
          phone_organizationId: {
            phone: formattedPhone,
            organizationId: org.id,
          },
        },
        create: {
          organizationId: org.id,
          name: body.name.trim(),
          phone: formattedPhone,
          email: body.email?.trim() || null,
          type: 'LEAD',
          status: 'ACTIVE',
          utmSource: body.utmSource || 'b2b_partner',
          affiliateCode,
        },
        update: {
          name: body.name.trim(),
          ...(body.email?.trim() ? { email: body.email.trim() } : {}),
          utmSource: body.utmSource || 'b2b_partner',
        },
        select: { id: true },
      });
      contactId = contact.id;

      // ── 3) 리드 점수 +30 ──
      await addLeadScore(contactId, 'LANDING_REGISTER');
    } catch (e) {
      logger.error('[B2B Lead] Contact upsert 실패 (비치명적)', { err: e });
    }

    // ── 4) B2BLandingRegistration 생성 ──
    let registrationId: string | null = null;
    if (body.landingPageId) {
      try {
        const reg = await prisma.b2BLandingRegistration.create({
          data: {
            landingPageId: body.landingPageId,
            name: body.name.trim(),
            phone: formattedPhone,
            email: body.email?.trim() || null,
            utmSource: body.utmSource || null,
            utmMedium: body.utmMedium || null,
            utmCampaign: body.utmCampaign || null,
            metadata: body.metadata || null,
          },
          select: { id: true },
        });
        registrationId = reg.id;
      } catch {
        // unique constraint violation = 중복, 무시
      }
    }

    // ── 5) 퍼널 자동 시작 (landingPage에 groupId + autoFunnelId 설정되어 있으면) ──
    if (body.landingPageId && contactId) {
      try {
        const lp = await prisma.b2BLandingPage.findUnique({
          where: { id: body.landingPageId },
          select: { groupId: true, autoFunnelId: true },
        });

        if (lp?.groupId) {
          // 그룹에 연락처 추가
          await prisma.contactGroupMember.upsert({
            where: {
              contactId_groupId: { contactId, groupId: lp.groupId },
            },
            create: { contactId, groupId: lp.groupId },
            update: {},
          });

          // 퍼널 트리거
          await triggerGroupFunnel({
            contactId,
            groupId: lp.groupId,
            organizationId: org.id,
          });

          // funnelStarted 업데이트
          if (registrationId) {
            await prisma.b2BLandingRegistration.update({
              where: { id: registrationId },
              data: { funnelStarted: true },
            }).catch(() => {});
          }
        }
      } catch (e) {
        logger.error('[B2B Lead] 퍼널 트리거 실패 (비치명적)', { err: e });
      }
    }

    logger.log('[POST /api/public/b2b/p] B2B 리드 등록 + CRM 연동', {
      partnerId,
      orgName: org.name,
      prospectId: prospect.id,
      contactId,
      registrationId,
      phone: formattedPhone.substring(0, 4) + '***',
    });

    return NextResponse.json({
      ok: true,
      message: '상담 신청이 접수되었습니다. 담당자가 빠르게 연락드리겠습니다.',
      prospectId: prospect.id,
    });
  } catch (err) {
    logger.error('[POST /api/public/b2b/p/[partnerId]]', { err });
    return NextResponse.json({ ok: false, message: '신청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
