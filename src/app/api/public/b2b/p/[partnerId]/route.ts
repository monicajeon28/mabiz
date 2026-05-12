import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkBotGuard } from '@/lib/bot-guard';
import { checkOrigin } from '@/lib/origin-guard';

type Params = { params: Promise<{ partnerId: string }> };

/**
 * GET /api/public/b2b/p/[partnerId]?info=1
 * 파트너 정보 조회 (공개 - 랜딩페이지용)
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { partnerId } = await params;

    // partnerId로 Organization + 소유자 정보 조회
    // partnerId는 Organization.slug 또는 externalAffiliateProfileId(숫자)
    const partnerIdNum = Number(partnerId);
    let org: { id: string; name: string; slug: string; externalAffiliateProfileId: number | null } | null = null;

    if (!isNaN(partnerIdNum)) {
      org = await prisma.organization.findFirst({
        where: { externalAffiliateProfileId: partnerIdNum, status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, externalAffiliateProfileId: true },
      });
    }

    if (!org) {
      org = await prisma.organization.findFirst({
        where: { slug: partnerId, status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, externalAffiliateProfileId: true },
      });
    }

    if (!org) {
      return NextResponse.json({ ok: false, message: '파트너를 찾을 수 없습니다.' }, { status: 404 });
    }

    // OWNER 멤버에서 affiliateCode 추출 시도
    let affiliateCode: string | null = null;
    if (org.externalAffiliateProfileId) {
      // 크루즈몰 AffiliateProfile.affiliateCode 는 Contact.affiliateCode 에 저장될 수 있음
      // 여기서는 externalAffiliateProfileId를 affiliateCode 대체로 사용
      affiliateCode = String(org.externalAffiliateProfileId);
    }

    return NextResponse.json({
      ok: true,
      partner: {
        name: org.name,
        affiliateCode,
      },
    });
  } catch (err) {
    logger.error('[GET /api/public/b2b/p/[partnerId]]', { err });
    return NextResponse.json({ ok: false, message: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/public/b2b/p/[partnerId]
 * B2B 리드 등록 (인증 불필요, 공개 API)
 *
 * body: { name, phone, company?, email?, packageInterest? }
 */
export async function POST(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, 'B2BPartnerLead')) {
      return NextResponse.json({ ok: false, message: '허용되지 않은 요청입니다.' }, { status: 403 });
    }

    const { partnerId } = await params;

    // ── 1. 파트너(조직) 조회 ──
    const partnerIdNum = Number(partnerId);
    let org: { id: string; name: string; externalAffiliateProfileId: number | null } | null = null;

    if (!isNaN(partnerIdNum)) {
      org = await prisma.organization.findFirst({
        where: { externalAffiliateProfileId: partnerIdNum, status: 'ACTIVE' },
        select: { id: true, name: true, externalAffiliateProfileId: true },
      });
    }

    if (!org) {
      org = await prisma.organization.findFirst({
        where: { slug: partnerId, status: 'ACTIVE' },
        select: { id: true, name: true, externalAffiliateProfileId: true },
      });
    }

    // 최종 폴백: DEFAULT_ORGANIZATION_ID
    if (!org) {
      const defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID;
      if (defaultOrgId) {
        org = await prisma.organization.findUnique({
          where: { id: defaultOrgId },
          select: { id: true, name: true, externalAffiliateProfileId: true },
        });
      }
    }

    if (!org) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 파트너 링크입니다.' }, { status: 404 });
    }

    // ── 2. 요청 바디 파싱 + 검증 ──
    const body = await req.json() as {
      name?: string;
      phone?: string;
      company?: string;
      email?: string;
      packageInterest?: string;
      // 봇 가드 필드
      website?: string;
      hp?: string;
      loadedAt?: number;
    };

    if (!checkBotGuard(body as Record<string, unknown>, 'B2BPartnerLead')) {
      return NextResponse.json({ ok: true }); // 봇 조용히 차단
    }

    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ ok: false, message: '이름과 전화번호는 필수입니다.' }, { status: 400 });
    }

    const normalizedPhone = body.phone.replace(/[^0-9]/g, '');
    if (normalizedPhone.length < 10) {
      return NextResponse.json({ ok: false, message: '올바른 연락처를 입력해주세요.' }, { status: 400 });
    }

    // 전화번호 포맷팅 (010-1234-5678)
    const formattedPhone = normalizedPhone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');

    // ── 3. 중복 체크: 같은 phone + 같은 org에서 48시간 이내 ──
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const duplicate = await prisma.b2BProspect.findFirst({
      where: {
        phone: formattedPhone,
        organizationId: org.id,
        createdAt: { gte: fortyEightHoursAgo },
      },
      select: { id: true, createdAt: true },
    });

    if (duplicate) {
      logger.log('[POST /api/public/b2b/p] 48시간 내 중복 리드', {
        partnerId,
        phone: formattedPhone.substring(0, 4) + '***',
        existingId: duplicate.id,
      });
      return NextResponse.json({
        ok: true,
        message: '이미 신청이 접수되었습니다. 담당자가 곧 연락드리겠습니다.',
        duplicate: true,
      });
    }

    // ── 4. OWNER 멤버 찾기 (담당자 배정) ──
    const ownerMember = await prisma.organizationMember.findFirst({
      where: { organizationId: org.id, role: 'OWNER', isActive: true },
      select: { userId: true },
    });

    // ── 5. B2BProspect 생성 ──
    const affiliateCode = org.externalAffiliateProfileId
      ? String(org.externalAffiliateProfileId)
      : null;

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId:  org.id,
        name:            body.name.trim(),
        phone:           formattedPhone,
        email:           body.email?.trim()    || null,
        companyName:     body.company?.trim()   || null,
        packageInterest: body.packageInterest  || null,
        source:          'B2B_PARTNER',
        status:          'NEW',
        assignedUserId:  ownerMember?.userId   || null,
        affiliateCode,
        notes:           `파트너 B2B 랜딩 유입 (partnerId: ${partnerId})`,
      },
      select: { id: true },
    });

    logger.log('[POST /api/public/b2b/p] B2B 파트너 리드 등록', {
      partnerId,
      orgName: org.name,
      prospectId: prospect.id,
      phone: formattedPhone.substring(0, 4) + '***',
      packageInterest: body.packageInterest,
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
