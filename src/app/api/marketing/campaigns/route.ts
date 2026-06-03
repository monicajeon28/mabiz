import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// ── GET /api/marketing/campaigns — 캠페인 목록 조회 ────────────────
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, message: '조직 정보가 없습니다. 조직을 선택해주세요.' }, { status: 403 });
    }
    const url = new URL(req.url);
    const organizationId = ctx.organizationId;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20') || 20);
    const offset = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.crmMarketingCampaign.findMany({
        where: { organizationId },
        include: { group: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.crmMarketingCampaign.count({ where: { organizationId } }),
    ]);

    return NextResponse.json({
      ok: true,
      campaigns,
      pagination: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns]', { err });
    return handleApiError(err);
  }
}

// ── POST /api/marketing/campaigns — 캠페인 생성 ────────────────────
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      groupId,
      title,
      sendEmail,
      emailSubject,
      emailBody,
      sendSms,
      smsBody,
      includeLanding,
      landingUrl,
      landingLinkText,
      sendAt,
      repeatRule,
    } = body;

    if (!groupId || !title || !sendAt) {
      return NextResponse.json(
        { ok: false, message: 'groupId, title, sendAt는 필수입니다.' },
        { status: 400 }
      );
    }

    // 채널별 메시지 필수 필드 검증
    if (sendEmail && (!emailSubject?.trim() || !emailBody?.trim())) {
      return NextResponse.json(
        { ok: false, message: '이메일 선택 시 제목과 본문은 필수입니다.' },
        { status: 400 }
      );
    }

    if (sendSms && !smsBody?.trim()) {
      return NextResponse.json(
        { ok: false, message: '문자 선택 시 본문은 필수입니다.' },
        { status: 400 }
      );
    }

    if (includeLanding && (!landingUrl?.trim() || !landingLinkText?.trim())) {
      return NextResponse.json(
        { ok: false, message: '랜딩 링크 선택 시 URL과 텍스트는 필수입니다.' },
        { status: 400 }
      );
    }

    // landingUrl 프로토콜 검증 (javascript:, data: 차단)
    if (includeLanding && landingUrl) {
      try {
        const url = new URL(landingUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return NextResponse.json(
            { ok: false, message: 'https:// 또는 http://로 시작하는 URL만 허용됩니다.' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { ok: false, message: '유효한 URL이 아닙니다.' },
          { status: 400 }
        );
      }
    }

    // SMS 길이 제한 (프론트엔드 90자 제한 동기화)
    if (sendSms && smsBody && smsBody.length > 90) {
      return NextResponse.json(
        { ok: false, message: '문자는 최대 90자입니다.' },
        { status: 400 }
      );
    }

    // 그룹 멤버 수를 포함해 조회 (단일 원자 연산)
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId ?? undefined,
        organizationId: ctx.organizationId ?? undefined,
      },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const memberCount = group._count.members;

    // 빈 그룹 검증
    if (memberCount === 0) {
      return NextResponse.json(
        { ok: false, message: '선택한 그룹에 연락처가 없습니다.' },
        { status: 400 }
      );
    }

    const campaign = await prisma.crmMarketingCampaign.create({
      data: {
        organizationId: ctx.organizationId ?? '',
        groupId: groupId ?? '',
        title,
        sendEmail: sendEmail === true,
        emailSubject: emailSubject || null,
        emailBody: emailBody || null,
        sendSms: sendSms === true,
        smsBody: smsBody || null,
        includeLanding: includeLanding === true,
        landingUrl: landingUrl || null,
        landingLinkText: landingLinkText || null,
        sendAt: new Date(sendAt),
        repeatRule: repeatRule || null,
        totalCount: memberCount,
        status: 'DRAFT',
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/marketing/campaigns]', { err });
    return handleApiError(err);
  }
}
