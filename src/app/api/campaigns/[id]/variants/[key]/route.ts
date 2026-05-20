export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { UpdateVariantSchema } from '@/schemas/campaign-variant';

/**
 * PATCH /api/campaigns/[id]/variants/[key]
 * Variant 수정 (SMS/Email 내용, trafficSplit 등)
 *
 * 요청 예시:
 * {
 *   "smsBody": "Updated SMS",
 *   "trafficSplit": 0.3
 * }
 *
 * 응답 (200):
 * {
 *   "ok": true,
 *   "variant": { ... }
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    // 1. 인증 확인
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // params가 Promise 인 경우 await
    const resolvedParams = await params;

    // 2. IDOR 방지: Campaign의 organizationId 확인
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
        `[PATCH /variants/[key]] Campaign not found: ${resolvedParams.id}`,
        { orgId }
      );
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.organizationId !== orgId) {
      logger.warn(
        `[PATCH /variants/[key]] IDOR attempt`,
        { campaignId: resolvedParams.id, orgId }
      );
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 3. DRAFT만 수정 가능
    if (campaign.status !== 'DRAFT') {
      logger.warn(
        `[PATCH /variants/[key]] Cannot update variant for non-DRAFT campaign`,
        { campaignId: resolvedParams.id, status: campaign.status }
      );
      return NextResponse.json(
        { error: `DRAFT 상태의 캠페인만 Variant를 수정할 수 있습니다 (현재: ${campaign.status})` },
        { status: 400 }
      );
    }

    // 4. Variant 존재 확인
    const variant = await prisma.campaignVariant.findUnique({
      where: {
        campaignId_variantKey: {
          campaignId: resolvedParams.id,
          variantKey: resolvedParams.key as 'A' | 'B',
        },
      },
    });

    if (!variant) {
      logger.warn(
        `[PATCH /variants/[key]] Variant not found`,
        { campaignId: resolvedParams.id, key: resolvedParams.key }
      );
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      );
    }

    // 5. 요청 검증
    const body = await request.json();
    const validation = UpdateVariantSchema.safeParse(body);

    if (!validation.success) {
      logger.warn(
        `[PATCH /variants/[key]] Validation failed`,
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

    // 6. Variant 수정 (undefined는 기존값 유지)
    const updated = await prisma.campaignVariant.update({
      where: {
        campaignId_variantKey: {
          campaignId: resolvedParams.id,
          variantKey: resolvedParams.key as 'A' | 'B',
        },
      },
      data: {
        ...(validation.data.smsBody !== undefined && {
          smsBody: validation.data.smsBody,
        }),
        ...(validation.data.emailSubject !== undefined && {
          emailSubject: validation.data.emailSubject,
        }),
        ...(validation.data.emailBody !== undefined && {
          emailBody: validation.data.emailBody,
        }),
        ...(validation.data.trafficSplit !== undefined && {
          trafficSplit: validation.data.trafficSplit,
        }),
        ...(validation.data.isActive !== undefined && {
          isActive: validation.data.isActive,
        }),
      },
    });

    logger.info(
      `[PATCH /variants/[key]] Variant updated`,
      { campaignId: resolvedParams.id, key: resolvedParams.key, orgId }
    );

    return NextResponse.json({
      ok: true,
      variant: updated,
    });
  } catch (error) {
    logger.error(
      '[PATCH /variants/[key]] Unexpected error',
      error,
      { campaignId: resolvedParams.id, key: resolvedParams.key }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[id]/variants/[key]
 * Variant 삭제 (DRAFT만)
 *
 * 응답 (200):
 * {
 *   "ok": true,
 *   "message": "Variant A deleted"
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    // 1. 인증 확인
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // params가 Promise인 경우 await
    const resolvedParams = await params;

    // 2. IDOR 방지
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
        `[DELETE /variants/[key]] Campaign not found: ${resolvedParams.id}`,
        { orgId }
      );
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.organizationId !== orgId) {
      logger.warn(
        `[DELETE /variants/[key]] IDOR attempt`,
        { campaignId: resolvedParams.id, orgId }
      );
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 3. DRAFT만 삭제 가능
    if (campaign.status !== 'DRAFT') {
      logger.warn(
        `[DELETE /variants/[key]] Cannot delete variant from non-DRAFT campaign`,
        { campaignId: resolvedParams.id, status: campaign.status }
      );
      return NextResponse.json(
        { error: `DRAFT 상태의 캠페인만 Variant를 삭제할 수 있습니다 (현재: ${campaign.status})` },
        { status: 400 }
      );
    }

    // 4. Variant 삭제
    try {
      await prisma.campaignVariant.delete({
        where: {
          campaignId_variantKey: {
            campaignId: resolvedParams.id,
            variantKey: resolvedParams.key as 'A' | 'B',
          },
        },
      });

      logger.info(
        `[DELETE /variants/[key]] Variant deleted`,
        { campaignId: resolvedParams.id, key: resolvedParams.key, orgId }
      );

      return NextResponse.json({
        ok: true,
        message: `Variant ${resolvedParams.key} deleted`,
      });
    } catch (deleteError) {
      if ((deleteError as any).code === 'P2025') {
        logger.warn(
          `[DELETE /variants/[key]] Variant not found during deletion`,
          { campaignId: resolvedParams.id, key: resolvedParams.key }
        );
        return NextResponse.json(
          { error: 'Variant not found' },
          { status: 404 }
        );
      }
      throw deleteError;
    }
  } catch (error) {
    logger.error(
      '[DELETE /variants/[key]] Unexpected error',
      error,
      { campaignId: resolvedParams.id, key: resolvedParams.key }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
