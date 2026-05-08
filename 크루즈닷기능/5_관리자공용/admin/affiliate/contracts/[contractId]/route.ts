export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

// GET: 계약서 상세 정보 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const resolvedParams = await params;
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const { contractId: contractIdStr } = resolvedParams;
    const contractId = parseInt(contractIdStr);
    if (isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mallUserId: true,
          },
        },
        User_AffiliateContract_reviewerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            type: true,
            affiliateCode: true,
            branchLabel: true,
            contactPhone: true,
            contactEmail: true,
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                mallUserId: true,
              },
            },
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: 'Contract not found' }, { status: 404 });
    }

    // 프론트엔드에서 기대하는 형식으로 변환
    const { User_AffiliateContract_userIdToUser, User_AffiliateContract_reviewerIdToUser, AffiliateProfile, ...rest } = contract;
    
    // AffiliateProfile 내부의 User를 user로 변환
    const transformedAffiliateProfile = AffiliateProfile ? (() => {
      const { User, ...profileRest } = AffiliateProfile;
      return {
        ...profileRest,
        user: User,
      };
    })() : null;
    
    const transformedContract = {
      ...rest,
      user: User_AffiliateContract_userIdToUser,
      reviewer: User_AffiliateContract_reviewerIdToUser,
      AffiliateProfile: transformedAffiliateProfile,
    };

    return NextResponse.json({ ok: true, contract: transformedContract });
  } catch (error) {
    console.error(`GET /api/admin/affiliate/contracts/${resolvedParams.contractId} error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    return NextResponse.json({ 
      ok: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}

// DELETE: 계약서 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const resolvedParams = await params;
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const { contractId: contractIdStr } = resolvedParams;
    const contractId = parseInt(contractIdStr);
    if (isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    // 계약서 존재 확인
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: 'Contract not found' }, { status: 404 });
    }

    // 계약서 삭제
    await prisma.affiliateContract.delete({
      where: { id: contractId },
    });

    return NextResponse.json({ ok: true, message: '계약서가 삭제되었습니다.' });
  } catch (error) {
    console.error(`DELETE /api/admin/affiliate/contracts/${resolvedParams.contractId} error:`, error);
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
