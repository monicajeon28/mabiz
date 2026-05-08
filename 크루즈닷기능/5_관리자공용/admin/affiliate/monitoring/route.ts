export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/monitoring/route.ts
// 계약/수당/DB 회수 모니터링 API

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { role: true } } },
    });
    return session?.User?.role === 'admin' ?? false;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!await checkAdminAuth(sid)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. 계약 상태 요약
    const contractStats = {
      total: await prisma.affiliateContract.count(),
      active: await prisma.affiliateContract.count({ where: { status: 'approved' } }),
      pending: await prisma.affiliateContract.count({ where: { status: 'submitted' } }),
      terminated: await prisma.affiliateContract.count({ where: { status: 'terminated' } }),
      renewalPending: await prisma.affiliateContract.count({
        where: {
          status: 'approved',
          metadata: {
            path: ['renewalRequestStatus'],
            equals: 'PENDING',
          },
        },
      }),
    };

    // 2. DB 회수 대기/실패 목록
    const dbRecoveryIssues = await prisma.affiliateContract.findMany({
      where: {
        status: 'terminated',
        metadata: {
          path: ['dbRecovered'],
          equals: false,
        },
      },
      include: {
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            displayName: true,
          },
        },
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const dbRecoveryList = dbRecoveryIssues.map(contract => {
      const metadata = contract.metadata as any;
      const terminatedAt = metadata?.terminatedAt ? new Date(metadata.terminatedAt) : null;
      const daysSinceTermination = terminatedAt 
        ? Math.floor((now.getTime() - terminatedAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      
      return {
        contractId: contract.id,
        contractType: contract.AffiliateProfile?.type || 'UNKNOWN',
        profileName: contract.AffiliateProfile?.displayName || 'Unknown',
        userName: contract.User_AffiliateContract_userIdToUser?.name || 'Unknown',
        userPhone: contract.User_AffiliateContract_userIdToUser?.phone || null,
        terminatedAt: terminatedAt?.toISOString() || null,
        daysSinceTermination,
        retryCount: metadata?.retryCount || 0,
        lastRetryAt: metadata?.lastRetryAt || null,
        lastError: metadata?.retryErrors?.[metadata.retryErrors.length - 1]?.error || null,
        needsAttention: (metadata?.retryCount || 0) >= 3 || (daysSinceTermination !== null && daysSinceTermination > 1),
      };
    });

    // 3. 최근 계약 해지 목록 (최근 7일)
    const recentTerminations = await prisma.affiliateContract.findMany({
      where: {
        status: 'terminated',
        updatedAt: { gte: sevenDaysAgo },
      },
      include: {
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            displayName: true,
          },
        },
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    // 4. 수당 계산 오류 목록 (최근 7일)
    const commissionErrors = await prisma.affiliateSale.findMany({
      where: {
        metadata: {
          path: ['commissionProcessed'],
          equals: false,
        },
        createdAt: { gte: sevenDaysAgo },
      },
      include: {
        AffiliateProfile_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
          },
        },
        AffiliateProfile_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 5. 최근 감사 로그 (최근 24시간)
    const recentAuditLogs = await prisma.affiliateAuditLog.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      data: {
        contractStats,
        dbRecoveryIssues: {
          total: dbRecoveryList.length,
          needsAttention: dbRecoveryList.filter(item => item.needsAttention).length,
          list: dbRecoveryList,
        },
        recentTerminations: recentTerminations.map(contract => {
          const metadata = contract.metadata as any;
          return {
            contractId: contract.id,
            contractType: contract.AffiliateProfile?.type || 'UNKNOWN',
            profileName: contract.AffiliateProfile?.displayName || 'Unknown',
            userName: contract.User_AffiliateContract_userIdToUser?.name || 'Unknown',
            terminatedAt: metadata?.terminatedAt || contract.updatedAt.toISOString(),
            reason: metadata?.terminationReason || 'Unknown',
          };
        }),
        commissionErrors: {
          total: commissionErrors.length,
          list: commissionErrors.map(sale => ({
            saleId: sale.id,
            productCode: sale.productCode,
            saleAmount: sale.saleAmount,
            managerName: sale.AffiliateProfile_managerIdToAffiliateProfile?.displayName || 'Unknown',
            agentName: sale.AffiliateProfile_agentIdToAffiliateProfile?.displayName || null,
            createdAt: sale.createdAt.toISOString(),
          })),
        },
        recentAuditLogs: recentAuditLogs.map(log => ({
          id: log.id,
          category: log.category,
          action: log.action,
          contractId: log.contractId,
          saleId: log.saleId,
          performedBy: log.User ? { id: log.User.id, name: log.User.name } : null,
          performedBySystem: log.performedBySystem,
          createdAt: log.createdAt.toISOString(),
        })),
      },
    });
  } catch (error: any) {
    console.error('[Admin Monitoring API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
