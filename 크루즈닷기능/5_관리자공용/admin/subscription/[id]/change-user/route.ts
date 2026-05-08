export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface ChangeUserBody {
  name?: string;
  phone?: string;
  newUserId?: string | number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const subscriptionId = parseInt(id);
    const body: ChangeUserBody = await req.json();
    const { name, phone, newUserId } = body;

    // 이름과 연락처로 사용자 변경 (또는 새 사용자 ID로 변경)
    let targetUser;

    if (newUserId) {
      // 새 사용자 ID로 변경
      targetUser = await prisma.user.findUnique({
        where: { id: parseInt(String(newUserId)) },
        include: {
          AffiliateProfile: true,
        },
      });

      if (!targetUser) {
        return NextResponse.json({ ok: false, message: '새 사용자를 찾을 수 없습니다.' }, { status: 404 });
      }
    } else if (name && phone) {
      // 이름과 연락처로 기존 사용자 찾기 또는 생성
      const normalizedPhone = phone.replace(/[^0-9]/g, '');

      targetUser = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
        include: {
          AffiliateProfile: true,
        },
      });

      if (!targetUser) {
        // 새 사용자 생성
        const newMallUserId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        targetUser = await prisma.user.create({
          data: {
            name: name.trim(),
            phone: normalizedPhone,
            mallUserId: newMallUserId,
            password: 'qwe1', // 기본 비밀번호
          },
          include: {
            AffiliateProfile: true,
          },
        });
      } else {
        // 기존 사용자 정보 업데이트
        targetUser = await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            name: name.trim(),
          },
          include: {
            AffiliateProfile: true,
          },
        });
      }
    } else {
      return NextResponse.json({ ok: false, message: '이름과 연락처 또는 새 사용자 ID가 필요합니다.' }, { status: 400 });
    }

    // 구독(계약) 정보 가져오기
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: subscriptionId },
      include: {
        User_AffiliateContract_userIdToUser: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: '구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    const oldProfileId = contract.User_AffiliateContract_userIdToUser?.AffiliateProfile?.id;
    const newProfileId = targetUser.AffiliateProfile?.id;

    if (!newProfileId) {
      return NextResponse.json({ ok: false, message: '새 사용자에게 어필리에이트 프로필이 없습니다.' }, { status: 400 });
    }

    // 계약의 userId 업데이트
    await prisma.affiliateContract.update({
      where: { id: subscriptionId },
      data: {
        userId: targetUser.id,
        invitedByProfileId: newProfileId,
      },
    });

    // 기존 프로필의 링크들을 새 프로필로 이전
    if (oldProfileId) {
      await prisma.affiliateLink.updateMany({
        where: {
          OR: [
            { agentId: oldProfileId },
            { managerId: oldProfileId },
          ],
        },
        data: {
          agentId: newProfileId,
          managerId: newProfileId,
        },
      });

      logger.log('[Subscription Change User] Links updated', {
        subscriptionId,
        oldProfileId,
        newProfileId,
        linksUpdated: true,
      });
    }

    logger.log('[Subscription Change User]', {
      subscriptionId,
      oldUserId: contract.userId,
      newUserId: targetUser.id,
    });

    return NextResponse.json({
      ok: true,
      message: '링크 사용자가 변경되었습니다.',
    });
  } catch (error: unknown) {
    logger.error('[Subscription Change User API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: '변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
