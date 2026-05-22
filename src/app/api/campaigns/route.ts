export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  CampaignCreateSchema,
  CampaignListQuerySchema,
  type CampaignCreateData,
} from '@/schemas/campaign';

/**
 * 캠페인 객체 직렬화 헬퍼
 */
const serializeCampaign = (campaign: any) => ({
  id: campaign.id,
  title: campaign.title,
  status: campaign.status,
  sendSms: campaign.sendSms,
  sendEmail: campaign.sendEmail,
  sendAt: campaign.sendAt,
  repeatRule: campaign.repeatRule,
  sentCount: campaign.sentCount,
  totalCount: campaign.totalCount,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

// ============================================================================
// GET /api/campaigns — 캠페인 목록 조회
// ============================================================================
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 쿼리 파라미터 파싱
    const url = new URL(req.url);
    const queryParams = {
      status: url.searchParams.get('status') || undefined,
      createdByMe: url.searchParams.get('createdByMe') || undefined,
      limit: url.searchParams.get('limit') || '20',
      offset: url.searchParams.get('offset') || '0',
    };

    const validation = CampaignListQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues.map((issue) => [
          issue.path.join('.'),
          issue.message,
        ])
      );
      return NextResponse.json(
        { ok: false, error: 'INVALID_QUERY', message: '쿼리 파라미터 검증에 실패했습니다.', errors: fieldErrors },
        { status: 400 }
      );
    }

    const { status, createdByMe, limit, offset } = validation.data;

    // 필터 조건 구성
    const where: any = { organizationId: orgId };

    if (status) {
      where.status = status;
    }

    // P0-7: createdBy 필드 미정의 상태이므로 향후 구현 필요
    // createdBy 필드가 schema에 추가되면 아래 주석을 해제
    // if (createdByMe) {
    //   where.createdBy = ctx.userId;
    // }

    // 전체 개수 조회 (페이지네이션용)
    const total = await prisma.crmMarketingCampaign.count({ where });

    // 캠페인 목록 조회
    const campaigns = await prisma.crmMarketingCampaign.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        sendSms: true,
        sendEmail: true,
        sendAt: true,
        repeatRule: true,
        sentCount: true,
        totalCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const result = campaigns.map(serializeCampaign);

    logger.log('[GET /api/campaigns]', { orgId, total, returned: result.length });

    return NextResponse.json({
      ok: true,
      campaigns: result,
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('[GET /api/campaigns]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/campaigns — 캠페인 생성
// ============================================================================
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const body = await req.json();
    const validation = CampaignCreateSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues.map((issue) => [
          issue.path.join('.'),
          issue.message,
        ])
      );
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '입력값 검증에 실패했습니다.', errors: fieldErrors },
        { status: 400 }
      );
    }

    const data = validation.data as CampaignCreateData;

    // ✅ 그룹 소유권 검증
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: data.groupId,
        organizationId: orgId,
      },
      select: { id: true, organizationId: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ sendAt이 미래 시간인지 검증
    const sendAt = new Date(data.sendAt);
    if (sendAt <= new Date()) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '발송 시간은 현재 시간보다 이후여야 합니다.' },
        { status: 400 }
      );
    }

    // ✅ 최소한 하나의 채널은 활성화되어야 함
    if (!data.sendSms && !data.sendEmail) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '최소한 SMS 또는 이메일 중 하나를 활성화해야 합니다.' },
        { status: 400 }
      );
    }

    // ✅ includeLanding이 true인데 landingUrl이 없는 경우 검증
    if (data.includeLanding && !data.landingUrl) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '랜딩 페이지를 포함할 경우 URL을 입력해야 합니다.' },
        { status: 400 }
      );
    }

    // 캠페인 생성
    const campaign = await prisma.crmMarketingCampaign.create({
      data: {
        organizationId: orgId,
        groupId: data.groupId,
        title: data.title,
        sendSms: data.sendSms,
        smsBody: data.smsBody ?? null,
        sendEmail: data.sendEmail,
        emailSubject: data.emailSubject ?? null,
        emailBody: data.emailBody ?? null,
        includeLanding: data.includeLanding,
        landingUrl: data.landingUrl ?? null,
        landingLinkText: data.landingLinkText ?? null,
        sendAt,
        repeatRule: data.repeatRule ?? null,
        status: 'DRAFT',
        sentCount: 0,
        totalCount: 0,
      },
      select: {
        id: true,
        title: true,
        status: true,
        sendSms: true,
        sendEmail: true,
        sendAt: true,
        repeatRule: true,
        sentCount: true,
        totalCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.log('[POST /api/campaigns]', { orgId, campaignId: campaign.id, title: campaign.title });

    return NextResponse.json(
      {
        ok: true,
        campaign: serializeCampaign(campaign),
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/campaigns]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
