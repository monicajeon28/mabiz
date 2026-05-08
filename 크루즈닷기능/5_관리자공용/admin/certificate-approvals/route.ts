export const dynamic = 'force-dynamic';

// 관리자용 인증서 승인 관리 API
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';

// GET: 승인 요청 목록 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자, 대리점장, 판매원 모두 접근 가능
    const isAdmin = user.role === 'admin' || user.role === 'ADMIN';
    let affiliateProfile = null;

    if (!isAdmin) {
      // 대리점장, 본사, 판매원인지 확인
      affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
      });

      if (!affiliateProfile) {
        return NextResponse.json(
          { ok: false, error: '접근 권한이 없습니다.' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const certificateType = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (certificateType) {
      where.certificateType = certificateType;
    }

    // 권한별 필터링
    if (!isAdmin && affiliateProfile) {
      if (affiliateProfile.type === 'HQ') {
        // 본사는 전체 조회 가능 (Admin과 동일)
      } else if (affiliateProfile.type === 'BRANCH_MANAGER') {
        // 대리점장은 본인 요청 + 소속 판매원 요청 조회
        // 1. 본인 ID
        // 2. 소속 판매원들의 User ID 조회
        const agents = await prisma.affiliateProfile.findMany({
          where: { parentId: affiliateProfile.id },
          select: { userId: true }
        });
        const agentUserIds = agents.map(a => a.userId).filter(id => id !== null) as string[];

        where.requesterId = { in: [user.id, ...agentUserIds] };
      } else if (affiliateProfile.type === 'SALES_AGENT') {
        // 판매원은 본인 요청만 조회
        where.requesterId = user.id;
      }
    }

    const [approvals, total] = await Promise.all([
      prisma.certificateApproval.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          Requester: {
            select: {
              id: true,
              name: true,
              phone: true,
              AffiliateProfile: {
                select: {
                  type: true,
                  displayName: true,
                  branchLabel: true,
                },
              },
            },
          },
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              // ...
            },
          },
          Approver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.certificateApproval.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      approvals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[Admin Certificate Approvals GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '조회 실패' },
      { status: 500 }
    );
  }
}
