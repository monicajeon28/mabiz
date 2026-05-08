export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/pending-approval/route.ts
// 구매 완료 승인 대기 목록 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * GET: 구매 완료 승인 대기 목록 조회
 * - PURCHASED 상태인 고객 중 AffiliateSale이 PENDING이거나 없는 경우
 * - 고객 기록/녹음 정보 포함
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    // PURCHASED 상태인 고객 조회
    const purchasedLeads = await prisma.affiliateLead.findMany({
      where: {
        status: 'PURCHASED',
      },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
          },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
          },
        },
        AffiliateInteraction: {
          include: {
            AffiliateMedia: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                storagePath: true,
                createdAt: true,
              },
            },
            User: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { occurredAt: 'desc' },
        },
        AffiliateSale: {
          where: {
            status: {
              in: ['PENDING', 'PENDING_APPROVAL'], // 기존 프로세스와 새 프로세스 모두 지원
            },
          },
          select: {
            id: true,
            productCode: true,
            saleAmount: true,
            saleDate: true,
            status: true, // 상태도 반환
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 승인 대기 항목만 필터링 (AffiliateSale이 PENDING 또는 PENDING_APPROVAL이거나 없는 경우)
    // 참고: AffiliateSale은 이미 where 조건으로 PENDING/PENDING_APPROVAL 상태만 조회되므로
    // sales가 있으면 모두 승인 대기 상태입니다.
    const pendingApprovals = purchasedLeads
      .filter((lead: any) => {
        // AffiliateSale이 없거나 PENDING/PENDING_APPROVAL 상태인 경우
        const sales = lead.AffiliateSale || [];
        // sales가 있으면 모두 PENDING/PENDING_APPROVAL 상태 (이미 필터링됨)
        // sales가 없으면 아직 판매 기록이 없는 경우
        return true; // 모든 purchasedLeads가 승인 대기 대상
      })
      .map((lead: any) => {
        // 고객 기록/녹음 확인
        const interactions = lead.AffiliateInteraction || [];
        const sales = lead.AffiliateSale || [];
        const hasInteractions = interactions.length > 0;
        const hasRecordings = interactions.some((interaction: any) =>
          (interaction.AffiliateMedia || []).some((media: any) => {
            const mimeType = media.mimeType?.toLowerCase() || '';
            return mimeType.includes('audio') || mimeType.includes('video');
          })
        );
        const hasNotes = interactions.some((interaction: any) => interaction.note && interaction.note.trim().length > 0);

        return {
          leadId: lead.id,
          customerName: lead.customerName,
          customerPhone: lead.customerPhone,
          purchasedAt: lead.metadata && typeof lead.metadata === 'object' && 'purchasedAt' in lead.metadata
            ? (lead.metadata as any).purchasedAt
            : lead.createdAt.toISOString(),
          manager: (lead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile
            ? {
                id: (lead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.id,
                name: (lead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.displayName || (lead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.nickname || (lead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.affiliateCode,
                type: '대리점장',
              }
            : null,
          agent: (lead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile
            ? {
                id: (lead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.id,
                name: (lead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.displayName || (lead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.nickname || (lead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.affiliateCode,
                type: '판매원',
              }
            : null,
          sales: sales.map((sale: any) => ({
            id: sale.id,
            productCode: sale.productCode,
            saleAmount: sale.saleAmount,
            saleDate: sale.saleDate?.toISOString() || null,
            status: sale.status, // 상태 정보 포함
            createdAt: sale.createdAt.toISOString(),
          })),
          interactions: {
            count: interactions.length,
            hasRecordings,
            hasNotes,
            latest: interactions[0]
              ? {
                  type: interactions[0].interactionType,
                  note: interactions[0].note,
                  occurredAt: interactions[0].occurredAt.toISOString(),
                  mediaCount: (interactions[0].AffiliateMedia || []).length,
                }
              : null,
          },
          canApprove: hasInteractions && (hasRecordings || hasNotes), // 기록 또는 녹음이 있어야 승인 가능
        };
      });

    return NextResponse.json({
      ok: true,
      pendingApprovals,
      total: pendingApprovals.length,
    });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/sales/pending-approval error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ 
      ok: false, 
      message: error?.message || 'Server error',
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {})
    }, { status: 500 });
  }
}
