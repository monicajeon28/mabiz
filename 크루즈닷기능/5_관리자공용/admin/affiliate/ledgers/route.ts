export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/ledgers/route.ts
// 수수료 원장(CommissionLedger) 목록 조회 API

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
    logger.error('[Admin Ledgers] Auth error:', error);
    return null;
  }
}

/**
 * GET /api/admin/affiliate/ledgers
 * 수수료 원장 목록 조회
 * 쿼리: profileId, saleId, isSettled, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') ? parseInt(searchParams.get('profileId')!) : undefined;
    const saleId = searchParams.get('saleId') ? parseInt(searchParams.get('saleId')!) : undefined;
    const isSettledParam = searchParams.get('isSettled');
    const isSettled = isSettledParam === 'true' ? true : isSettledParam === 'false' ? false : undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};
    if (profileId !== undefined && !isNaN(profileId)) where.profileId = profileId;
    if (saleId !== undefined && !isNaN(saleId)) where.saleId = saleId;
    if (isSettled !== undefined) where.isSettled = isSettled;

    const [ledgers, total] = await Promise.all([
      prisma.commissionLedger.findMany({
        where,
        include: {
          AffiliateSale: {
            select: {
              id: true,
              productCode: true,
              saleAmount: true,
              saleDate: true,
              status: true,
              AffiliateLead: {
                select: {
                  id: true,
                  customerName: true,
                  customerPhone: true,
                },
              },
            },
          },
          AffiliateProfile: {
            select: {
              id: true,
              affiliateCode: true,
              displayName: true,
              nickname: true,
            },
          },
          CommissionAdjustment: {
            select: {
              id: true,
              amount: true,
              status: true,
              reason: true,
              requestedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.commissionLedger.count({ where }),
    ]);

    const formatted = ledgers.map((l) => ({
      id: l.id,
      saleId: l.saleId,
      profileId: l.profileId,
      entryType: l.entryType,
      amount: l.amount,
      currency: l.currency,
      withholdingAmount: l.withholdingAmount,
      isSettled: l.isSettled,
      settlementId: l.settlementId,
      settleableAfter: l.settleableAfter?.toISOString() ?? null,
      notes: l.notes,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      sale: l.AffiliateSale
        ? {
            id: l.AffiliateSale.id,
            productCode: l.AffiliateSale.productCode,
            saleAmount: l.AffiliateSale.saleAmount,
            saleDate: l.AffiliateSale.saleDate?.toISOString() ?? null,
            status: l.AffiliateSale.status,
            customer: l.AffiliateSale.AffiliateLead
              ? {
                  id: l.AffiliateSale.AffiliateLead.id,
                  name: l.AffiliateSale.AffiliateLead.customerName,
                  phone: l.AffiliateSale.AffiliateLead.customerPhone,
                }
              : null,
          }
        : null,
      profile: l.AffiliateProfile
        ? {
            id: l.AffiliateProfile.id,
            affiliateCode: l.AffiliateProfile.affiliateCode,
            displayName: l.AffiliateProfile.displayName ?? l.AffiliateProfile.nickname,
          }
        : null,
      adjustments: l.CommissionAdjustment.map((a) => ({
        id: a.id,
        amount: a.amount,
        status: a.status,
        reason: a.reason,
        requestedAt: a.requestedAt.toISOString(),
      })),
    }));

    return NextResponse.json({
      ok: true,
      ledgers: formatted,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[Admin Ledgers] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '원장 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
