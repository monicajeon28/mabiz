export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import {
  CreateVariantSchema,
  type CreateVariantInput,
} from '@/schemas/campaign-variant';

/**
 * GET /api/campaigns/[id]/variants
 * 캠페인의 모든 Variant 조회
 *
 * 응답 예시:
 * {
 *   "ok": true,
 *   "variants": [
 *     {
 *       "id": "var_123",
 *       "variantKey": "A",
 *       "smsBody": "Hello A",
 *       "emailSubject": "Subject A",
 *       "emailBody": "Body A",
 *       "trafficSplit": 0.5,
 *       "isActive": true,
 *       "createdAt": "2026-05-20T10:00:00Z"
 *     }
 *   ],
 *   "total": 1
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    // 1. 인증 확인
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // 2. IDOR 방지: Campaign의 organizationId 확인
    const campaign = await prisma.crmMarketingCampaign.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!campaign) {
      logger.warn(
        `[GET /variants] Campaign not found: ${resolvedParams.id}`,
        { orgId }
      );
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.organizationId !== orgId) {
      logger.warn(
        `[GET /variants] IDOR attempt: user orgId=${orgId}, campaign orgId=${campaign.organizationId}`,
        { campaignId: resolvedParams.id }
      );
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 3. Variant 조회
    const variants = await prisma.campaignVariant.findMany({
      where: { campaignId: resolvedParams.id },
      select: {
        id: true,
        variantKey: true,
        smsBody: true,
        emailSubject: true,
        emailBody: true,
        trafficSplit: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { variantKey: 'asc' },
    });

    logger.info(
      `[GET /variants] Retrieved ${variants.length} variants`,
      { campaignId: resolvedParams.id, orgId }
    );

    return NextResponse.json({
      ok: true,
      variants,
      total: variants.length,
    });
  } catch (error) {
    logger.error('[GET /variants] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      campaignId: resolvedParams.id,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/[id]/variants
 * Variant 생성 (A 또는 B)
 *
 * 요청 예시:
 * {
 *   "variantKey": "A",
 *   "smsBody": "Hello A",
 *   "trafficSplit": 0.5
 * }
 *
 * 응답 (201):
 * {
 *   "ok": true,
 *   "variant": { ... }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    // 1. 인증 확인
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // 2. IDOR 방지 + 캠페인 상태 확인
    const campaign = await prisma.crmMarketingCampaign.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!campaign) {
      logger.warn(
        `[POST /variants] Campaign not found: ${resolvedParams.id}`,
        { orgId }
      );
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.organizationId !== orgId) {
      logger.warn(
        `[POST /variants] IDOR attempt`,
        { campaignId: resolvedParams.id, orgId }
      );
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 3. DRAFT만 수정 가능 (발송 중이면 불가)
    if (campaign.status !== 'DRAFT') {
      logger.warn(
        `[POST /variants] Cannot create variant for non-DRAFT campaign`,
        { campaignId: resolvedParams.id, status: campaign.status }
      );
      return NextResponse.json(
        { error: `DRAFT 상태의 캠페인만 Variant를 생성할 수 있습니다 (현재: ${campaign.status})` },
        { status: 400 }
      );
    }

    // 4. 요청 검증
    const body = await request.json();
    const validation = CreateVariantSchema.safeParse(body);

    if (!validation.success) {
      logger.warn(
        `[POST /variants] Validation failed`,
        { errors: validation.error.issues }
      );
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { variantKey, smsBody, emailSubject, emailBody, trafficSplit } =
      validation.data;

    // 5. 중복 확인 (이미 A 또는 B 존재)
    const existing = await prisma.campaignVariant.findUnique({
      where: {
        campaignId_variantKey: {
          campaignId: resolvedParams.id,
          variantKey: variantKey,
        },
      },
    });

    if (existing) {
      logger.warn(
        `[POST /variants] Variant already exists`,
        { campaignId: resolvedParams.id, variantKey }
      );
      return NextResponse.json(
        { error: `Variant ${variantKey}는 이미 존재합니다` },
        { status: 409 }
      );
    }

    // 6. Variant 생성
    const variant = await prisma.campaignVariant.create({
      data: {
        campaignId: resolvedParams.id,
        variantKey,
        smsBody: smsBody || null,
        emailSubject: emailSubject || null,
        emailBody: emailBody || null,
        trafficSplit: trafficSplit ?? 0.5,
        isActive: true,
      },
    });

    logger.info(
      `[POST /variants] Variant created`,
      { campaignId: resolvedParams.id, variantKey, orgId }
    );

    return NextResponse.json(
      {
        ok: true,
        variant,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[POST /variants] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      campaignId: resolvedParams.id,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
