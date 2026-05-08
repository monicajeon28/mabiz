export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { profileInclude } from '../shared';

function normalizePhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

// GET: 프로필 상세 조회
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ profileId: string }> }
) {
  try {
    const params = await props.params;
    const profileIdStr = params.profileId;
    const profileId = Number(profileIdStr);

    if (!profileId || Number.isNaN(profileId)) {
      return NextResponse.json(
        { ok: false, message: '유효한 프로필 ID가 필요합니다.' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      include: profileInclude,
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, message: '프로필을 찾을 수 없습니다.' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json(
      { ok: true, profile },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[GET Profile] error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PUT: 프로필 수정
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ profileId: string }> }
) {
  try {
    const params = await props.params;
    const profileIdStr = params.profileId;
    const profileId = Number(profileIdStr);

    if (!profileId || Number.isNaN(profileId)) {
      return NextResponse.json(
        { ok: false, message: '유효한 프로필 ID가 필요합니다.' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Admin access required' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      type,
      status,
      displayName,
      branchLabel,
      nickname,
      contactPhone,
      contactEmail,
      bankName,
      bankAccount,
      bankAccountHolder,
      withholdingRate,
      contractStatus,
      published,
      landingSlug,
      invitedByProfileId,
    } = body;

    const existingProfile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: { id: true, type: true, metadata: true },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { ok: false, message: '프로필을 찾을 수 없습니다.' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (branchLabel !== undefined) updateData.branchLabel = branchLabel;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount;
    if (bankAccountHolder !== undefined) updateData.bankAccountHolder = bankAccountHolder;
    if (withholdingRate !== undefined) updateData.withholdingRate = withholdingRate;
    if (contractStatus !== undefined) updateData.contractStatus = contractStatus;
    if (published !== undefined) {
      updateData.published = published;
      if (published && !existingProfile.metadata) {
        updateData.publishedAt = new Date();
      }
    }
    if (landingSlug !== undefined) updateData.landingSlug = landingSlug;

    if (invitedByProfileId !== undefined) {
      const existingMetadata = (existingProfile.metadata as any) || {};
      updateData.metadata = {
        ...existingMetadata,
        invitedByProfileId: invitedByProfileId || null,
      };
    }

    const updatedProfile = await prisma.affiliateProfile.update({
      where: { id: profileId },
      data: updateData,
      include: profileInclude,
    });

    return NextResponse.json(
      { ok: true, profile: updatedProfile },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[PUT Profile] error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// DELETE: 프로필 삭제
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ profileId: string }> }
) {
  let profileId: number | null = null;

  try {
    const params = await props.params;
    const profileIdStr = params.profileId;
    profileId = Number(profileIdStr);

    if (!profileId || Number.isNaN(profileId)) {
      return NextResponse.json(
        { ok: false, message: '유효한 프로필 ID가 필요합니다.' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Admin access required' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        type: true,
        userId: true,
        contactPhone: true,
        User: {
          select: { phone: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, message: '프로필을 찾을 수 없습니다.' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // HQ 프로필만 삭제 불가
    if (profile.type === 'HQ') {
      return NextResponse.json(
        { ok: false, message: 'HQ 프로필은 삭제할 수 없습니다.' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await prisma.$transaction(async (tx) => {
      const phoneCandidates = new Set<string>();
      const rawPhones = [profile.contactPhone, profile.User?.phone];
      rawPhones.forEach((value) => {
        if (!value) return;
        const normalized = normalizePhone(value);
        const digits = value.replace(/[^0-9]/g, '');
        if (normalized) phoneCandidates.add(normalized);
        if (digits) phoneCandidates.add(digits);
      });

      const contractConditions: any[] = [];

      if (profile.userId) {
        contractConditions.push({ userId: profile.userId });
      }

      const existingMetadata = (profile as any).metadata || {};
      if (existingMetadata.invitedByProfileId) {
        contractConditions.push({
          metadata: {
            path: ['invitedByProfileId'],
            equals: profile.id,
          },
        });
      }

      if (phoneCandidates.size > 0) {
        contractConditions.push({
          phone: { in: Array.from(phoneCandidates) },
        });
      }

      let contractIds: number[] = [];
      if (contractConditions.length > 0) {
        const contracts = await tx.affiliateContract.findMany({
          where: { OR: contractConditions },
          select: { id: true },
        });
        contractIds = contracts.map((c) => c.id);
      }

      if (contractIds.length > 0) {
        await tx.affiliateDocument.deleteMany({
          where: { affiliateContractId: { in: contractIds } },
        });

        await tx.affiliateContract.deleteMany({
          where: { id: { in: contractIds } },
        });
      }

      await tx.affiliateProfile.delete({ where: { id: profileId! } });

      if (profile.userId) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { mallUserId: null, mallNickname: null },
        });
      }
    });

    return NextResponse.json(
      { ok: true, message: '프로필이 성공적으로 삭제되었습니다.' },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[DELETE Profile ${profileId}] error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      {
        ok: false,
        message: `프로필 삭제 중 오류가 발생했습니다: ${errorMessage}`
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
