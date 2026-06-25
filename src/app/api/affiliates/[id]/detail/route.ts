export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliates/[id]/detail
 * 지사장 상세 정보 (어필리에이트 코드, 추적링크, 산하 대리점장, 계약 정보)
 *
 * 접근: GLOBAL_ADMIN (전체) | OWNER (본인 프로필만)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type RawLink = {
  id: number;
  code: string;
  url: string;
  status: string;
  clickCount: number;
  conversionCount: number;
  totalRevenue: number;
  createdAt: Date;
};

type RawAgent = {
  profileId: number;
  userId: number;
  mallUserId: string | null;
  displayName: string | null;
  name: string | null;
  affiliateCode: string | null;
  status: string;
  isActive: boolean;
  contactPhone: string | null;
  phone: string | null;
  onboardedAt: Date | null;
  confirmedSales: bigint;
  totalSaleAmount: bigint;
};

type RawContract = {
  id: number;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  metadata: unknown;
  contractSignedAt: Date | null;
  createdAt: Date;
};

type RawProfile = {
  profileId: number;
  userId: number;
  mallUserId: string | null;
  type: string;
  status: string;
  isActive: boolean;
  autoSuspended: boolean;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contractStatus: string | null;
  agentCommissionRate: number | null;
  onboardedAt: Date | null;
  lastSalesDate: Date | null;
  createdAt: Date;
  name: string | null;
  phone: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const profileId = parseInt(idStr, 10);
    if (isNaN(profileId) || profileId <= 0) {
      return NextResponse.json({ ok: false, error: '유효한 ID가 아닙니다.' }, { status: 400 });
    }

    // OWNER는 본인 프로필만
    if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId || ownerProfileId !== profileId) {
        return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
      }
    }

    // ── 1. 프로필 기본 정보 ──────────────────────────────────────
    const profiles = await prisma.$queryRaw<RawProfile[]>`
      SELECT
        ap.id                    AS "profileId",
        ap."userId",
        ap.type,
        ap.status,
        ap."isActive",
        ap."autoSuspended",
        ap."displayName",
        ap."branchLabel",
        ap."affiliateCode",
        ap."contactPhone",
        ap."contactEmail",
        ap."contractStatus",
        ap."agentCommissionRate",
        ap."onboardedAt",
        ap."lastSalesDate",
        ap."createdAt",
        u."mallUserId",
        u.phone,
        u.name
      FROM "AffiliateProfile" ap
      JOIN "User" u ON u.id = ap."userId"
      WHERE ap.id = ${profileId}
      LIMIT 1
    `;

    if (!profiles.length) {
      return NextResponse.json({ ok: false, error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }
    const profile = profiles[0];

    // ── 2. 추적 링크 ─────────────────────────────────────────────
    const links = await prisma.$queryRaw<RawLink[]>`
      SELECT
        id, code, url, status,
        "clickCount", "conversionCount", "totalRevenue", "createdAt"
      FROM "AffiliateLink"
      WHERE "managerId" = ${profileId}
        AND status = 'ACTIVE'
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;

    // ── 3. 산하 대리점장 목록 ───────────────────────────────────────
    const agents = await prisma.$queryRaw<RawAgent[]>`
      SELECT
        ap.id                    AS "profileId",
        ap."userId",
        ap.status,
        ap."isActive",
        ap."displayName",
        ap."affiliateCode",
        ap."contactPhone",
        ap."onboardedAt",
        u."mallUserId",
        u.phone,
        u.name,
        COUNT(DISTINCT als.id) FILTER (WHERE als.status IN ('APPROVED','CONFIRMED'))::bigint AS "confirmedSales",
        COALESCE(SUM(CASE WHEN als.status IN ('APPROVED','CONFIRMED') THEN als."saleAmount" ELSE 0 END), 0)::bigint AS "totalSaleAmount"
      FROM "AffiliateRelation" ar
      JOIN "AffiliateProfile" ap ON ap.id = ar."agentId"
      JOIN "User" u ON u.id = ap."userId"
      LEFT JOIN "AffiliateSale" als ON als."agentId" = ap.id
      WHERE ar."managerId" = ${profileId}
        AND ar.status = 'ACTIVE'
      GROUP BY
        ap.id, ap.status, ap."isActive", ap."displayName", ap."affiliateCode",
        ap."contactPhone", ap."onboardedAt",
        u."mallUserId", u.phone, u.name
      ORDER BY ap."createdAt" DESC
    `;

    // ── 4. 계약 정보 ─────────────────────────────────────────────
    const contracts = await prisma.$queryRaw<RawContract[]>`
      SELECT
        id, status, name, email, phone, metadata, "contractSignedAt", "createdAt"
      FROM "AffiliateContract"
      WHERE "userId" = ${profile.userId}
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;

    // ── 5. 대리점장별 추적 링크 (agentId 기준) ─────────────────────
    const agentIds: number[] = agents.map((a) => a.profileId);
    const agentLinks =
      agentIds.length > 0
        ? await prisma.$queryRaw<{ agentId: number; code: string; url: string; clickCount: number }[]>`
            SELECT "agentId", code, url, "clickCount"
            FROM "AffiliateLink"
            WHERE "agentId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(agentIds)}]`})
              AND status = 'ACTIVE'
          `
        : [];

    const agentLinkMap: Record<number, { code: string; url: string; clickCount: number }> = {};
    for (const al of agentLinks) {
      agentLinkMap[al.agentId] = { code: al.code, url: al.url, clickCount: al.clickCount };
    }

    logger.log('[GET /api/affiliates/:id/detail]', { profileId, role: ctx.role });

    return NextResponse.json({
      ok: true,
      data: {
        profile: {
          profileId: profile.profileId,
          userId: profile.userId,
          mallUserId: profile.mallUserId,
          type: profile.type,
          status: profile.status,
          isActive: profile.isActive,
          autoSuspended: profile.autoSuspended,
          displayName: profile.displayName ?? profile.name ?? '',
          branchLabel: profile.branchLabel,
          affiliateCode: profile.affiliateCode,
          contactPhone: profile.contactPhone ?? profile.phone,
          contactEmail: profile.contactEmail,
          contractStatus: profile.contractStatus,
          agentCommissionRate: profile.agentCommissionRate,
          onboardedAt: profile.onboardedAt?.toISOString() ?? null,
          lastSalesDate: profile.lastSalesDate?.toISOString() ?? null,
          createdAt: profile.createdAt.toISOString(),
        },
        links: links.map((l) => ({
          id: l.id,
          code: l.code,
          url: l.url,
          status: l.status,
          clickCount: l.clickCount,
          conversionCount: l.conversionCount,
          totalRevenue: l.totalRevenue,
          createdAt: l.createdAt.toISOString(),
        })),
        agents: agents.map((a) => ({
          profileId: a.profileId,
          userId: a.userId,
          mallUserId: a.mallUserId,
          displayName: a.displayName ?? a.name ?? '',
          affiliateCode: a.affiliateCode,
          status: a.status,
          isActive: a.isActive,
          contactPhone: a.contactPhone ?? a.phone,
          onboardedAt: a.onboardedAt?.toISOString() ?? null,
          confirmedSales: Number(a.confirmedSales),
          totalSaleAmount: Number(a.totalSaleAmount),
          trackingLink: agentLinkMap[a.profileId] ?? null,
        })),
        contracts: contracts.map((c) => {
          const meta = c.metadata as Record<string, unknown> | null;
          return {
            id: c.id,
            status: c.status,
            name: c.name,
            email: c.email,
            phone: c.phone,
            contractSignedAt: c.contractSignedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
            tierKey: meta?.tierKey ?? null,
            amount: meta?.amount ?? null,
            approvedAt: meta?.approvedAt ?? null,
          };
        }),
      },
    });
  } catch (err) {
    logger.error('[GET /api/affiliates/:id/detail]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
