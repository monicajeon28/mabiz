import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId, canManageSettings } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/settings/kakao-config
 * 조직의 카카오톡 설정 조회
 */
export async function GET(_req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (!orgId) {
      return NextResponse.json(
        { ok: false, message: '조직 정보 없음' },
        { status: 403 }
      );
    }

    const kakaoConfig = await prisma.kakaoConfig.findFirst({
      where: { organizationId: orgId },
      select: {
        senderKey: true,
        isActive: true,
      },
    });

    if (!kakaoConfig) {
      return NextResponse.json({
        ok: true,
        config: null,
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        senderKey: kakaoConfig.senderKey,
        isActive: kakaoConfig.isActive,
      },
    });
  } catch (err) {
    logger.error('[kakao-config/GET]', { err });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/kakao-config
 * 조직의 카카오톡 설정 업데이트 또는 생성
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (!orgId) {
      return NextResponse.json(
        { ok: false, message: '조직 정보 없음' },
        { status: 403 }
      );
    }

    if (!canManageSettings(ctx)) {
      return NextResponse.json(
        { ok: false, message: 'OWNER 또는 관리자만 카카오 설정을 변경할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { senderKey, isActive } = await req.json() as {
      senderKey?: string;
      isActive?: boolean;
    };

    if (!senderKey?.trim()) {
      return NextResponse.json(
        { ok: false, message: '발신키를 입력하세요.' },
        { status: 400 }
      );
    }

    const existingConfig = await prisma.kakaoConfig.findFirst({
      where: { organizationId: orgId },
    });

    if (existingConfig) {
      await prisma.kakaoConfig.update({
        where: { id: existingConfig.id },
        data: {
          senderKey: senderKey.trim(),
          isActive: isActive !== undefined ? isActive : true,
        },
      });
    } else {
      await prisma.kakaoConfig.create({
        data: {
          organizationId: orgId,
          senderKey: senderKey.trim(),
          isActive: isActive !== undefined ? isActive : true,
        },
      });
    }

    logger.log('[kakao-config/PATCH]', { orgId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[kakao-config/PATCH]', { err });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
