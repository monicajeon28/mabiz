export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// 관리자 권한 확인
function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * GET: 판매몰 상세 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> | { profileId: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const resolvedParams = await Promise.resolve(params);
    const profileId = parseInt(resolvedParams.profileId, 10);
    if (isNaN(profileId)) {
      return NextResponse.json({ ok: false, message: 'Invalid profile ID' }, { status: 400 });
    }

    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mallUserId: true,
            mallNickname: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error: any) {
    logger.error('[Mall Detail] 오류', { error: error.message });
    return NextResponse.json(
      { ok: false, message: '판매몰 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 판매몰 수정
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> | { profileId: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const resolvedParams = await Promise.resolve(params);
    const profileId = parseInt(resolvedParams.profileId, 10);
    if (isNaN(profileId)) {
      return NextResponse.json({ ok: false, message: 'Invalid profile ID' }, { status: 400 });
    }

    const body = await req.json();
    const { mallUserId, landingSlug, published } = body;

    // 프로필 조회
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      include: { User: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    }

    // 트랜잭션으로 User + Profile 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 1. User의 mallUserId 업데이트 (변경된 경우에만)
      if (mallUserId !== undefined && profile.userId) {
        // 중복 검사 (다른 사용자가 이미 사용 중인지)
        if (mallUserId) {
          const existingUser = await tx.user.findFirst({
            where: {
              mallUserId,
              id: { not: profile.userId },
            },
          });
          if (existingUser) {
            throw new Error('이미 사용 중인 판매몰 ID입니다.');
          }
        }

        await tx.user.update({
          where: { id: profile.userId },
          data: {
            mallUserId: mallUserId || null,
          },
        });
      }

      // 2. Profile 업데이트
      const updatedProfile = await tx.affiliateProfile.update({
        where: { id: profileId },
        data: {
          landingSlug: landingSlug !== undefined ? (landingSlug || null) : undefined,
          published: published !== undefined ? published : undefined,
          updatedAt: new Date(),
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              mallUserId: true,
            },
          },
        },
      });

      return updatedProfile;
    });

    logger.log('[Mall Edit] 판매몰 수정 완료:', {
      profileId,
      mallUserId,
      landingSlug,
      published,
    });

    return NextResponse.json({
      ok: true,
      message: '판매몰이 성공적으로 수정되었습니다.',
      profile: result,
    });
  } catch (error: any) {
    logger.error('[Mall Edit] 오류', { error: error.message });
    return NextResponse.json(
      { ok: false, message: error.message || '판매몰 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
