export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/links/[linkId]/reissue/route.ts
// 어필리에이트 링크 재발급 API (만료된 링크를 새 코드로 재발급)

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { id: true, role: true } } },
    });
    if (!session?.User || session.User.role !== 'admin') return null;
    return session.User;
  } catch (error) {
    logger.error('[Reissue Link] Auth error:', error);
    return null;
  }
}

/** 고유 링크 코드 생성 (충돌 방지 재시도 포함) */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const code = `LINK-${timestamp}-${random}`.toUpperCase();
    const exists = await prisma.affiliateLink.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error('링크 코드 생성에 실패했습니다. 다시 시도해주세요.');
}

/**
 * POST /api/admin/affiliate/links/[linkId]/reissue
 * 만료되거나 비활성화된 어필리에이트 링크를 새 코드로 재발급합니다.
 * 요청: { expiresAt?: string (ISO 날짜), title?: string }
 * - 기존 링크는 EXPIRED 상태로 변경
 * - 동일 agent/manager/product로 새 ACTIVE 링크 생성
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { linkId: linkIdStr } = await params;
    const linkId = parseInt(linkIdStr);
    if (isNaN(linkId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 링크 ID가 아닙니다' },
        { status: 400 }
      );
    }

    let expiresAt: Date | null = null;
    let title: string | undefined;
    try {
      const body = await req.json();
      expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
      title = typeof body?.title === 'string' ? body.title.trim() : undefined;
    } catch {
      // 바디 없으면 기본값 사용
    }

    // 기존 링크 조회
    const originalLink = await prisma.affiliateLink.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        code: true,
        status: true,
        title: true,
        affiliateProductId: true,
        productCode: true,
        managerId: true,
        agentId: true,
        issuedById: true,
        campaignName: true,
        description: true,
        metadata: true,
      },
    });

    if (!originalLink) {
      return NextResponse.json(
        { ok: false, error: '링크를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 이미 활성 상태인 링크는 재발급 전 만료 여부 확인
    if (originalLink.status === 'ACTIVE') {
      // ACTIVE 링크도 재발급 가능 — 기존 링크를 EXPIRED로 처리
      logger.log('[Reissue Link] ACTIVE 링크 재발급 요청', { linkId, adminId: admin.id });
    }

    // 새 고유 코드 생성
    const newCode = await generateUniqueCode();
    const now = new Date();

    // 트랜잭션: 기존 링크 만료 + 새 링크 생성
    const [, newLink] = await prisma.$transaction([
      // 기존 링크 만료 처리
      prisma.affiliateLink.update({
        where: { id: linkId },
        data: {
          status: 'EXPIRED',
          expiresAt: now,
          updatedAt: now,
        },
      }),
      // 새 링크 생성
      prisma.affiliateLink.create({
        data: {
          code: newCode,
          title: title ?? originalLink.title ?? null,
          affiliateProductId: originalLink.affiliateProductId,
          productCode: originalLink.productCode ?? null,
          managerId: originalLink.managerId,
          agentId: originalLink.agentId,
          issuedById: admin.id,
          status: 'ACTIVE',
          expiresAt: expiresAt,
          campaignName: originalLink.campaignName ?? null,
          description: originalLink.description ?? null,
          metadata: originalLink.metadata ?? undefined,
          updatedAt: now,
        },
        include: {
          AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
            select: { id: true, displayName: true, affiliateCode: true },
          },
          AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
            select: { id: true, displayName: true, affiliateCode: true },
          },
          AffiliateProduct: {
            select: { id: true, productCode: true, title: true },
          },
        },
      }),
    ]);

    logger.log('[Reissue Link] 링크 재발급 완료', {
      adminId: admin.id,
      originalLinkId: linkId,
      newLinkId: newLink.id,
      newCode,
    });

    return NextResponse.json(
      {
        ok: true,
        message: '링크가 재발급되었습니다',
        originalLinkId: linkId,
        link: {
          id: newLink.id,
          code: newLink.code,
          status: newLink.status,
          title: newLink.title,
          expiresAt: newLink.expiresAt?.toISOString() ?? null,
          createdAt: newLink.createdAt.toISOString(),
          manager: newLink.AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile,
          agent: newLink.AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile,
          product: newLink.AffiliateProduct,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[Reissue Link] Error:', error);
    return NextResponse.json(
      { ok: false, error: '링크 재발급 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
