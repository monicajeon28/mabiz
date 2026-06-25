export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/affiliate-managers/[memberId]
 * 지사장 상세: 계정 정보 + 산하 대리점장 + 추적 링크 (AffiliateProfile 연결 시)
 *
 * 접근: GLOBAL_ADMIN 전용
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자 권한이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { memberId } = await params;

    // 1. 지사장 OrganizationMember
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            plan: true,
            status: true,
            externalAffiliateProfileId: true,
            contractRef: true,
            createdAt: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ ok: false, error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 산하 대리점장 (같은 Organization, 판매 역할 — 정지된 계정도 포함)
    const subMembers = await prisma.organizationMember.findMany({
      where: {
        organizationId: member.organizationId,
        role: { in: ['SALES_AGENT', 'FREE_SALES', 'PRE_SALES', 'AGENT'] },
      },
      select: {
        id: true,
        userId: true,
        phone: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
      },
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }],
    });

    // 3. AffiliateProfile + AffiliateLink (연결된 경우)
    const extProfileId = member.organization?.externalAffiliateProfileId ?? null;
    let affiliateData: {
      profileId: number;
      affiliateCode: string | null;
      status: string;
      agentCommissionRate: number | null;
      links: { id: number; code: string; url: string; clickCount: number; conversionCount: number }[];
    } | null = null;

    if (extProfileId) {
      type AffRow = {
        id: number;
        affiliateCode: string | null;
        status: string;
        agentCommissionRate: number | null;
      };
      const profiles = await prisma.$queryRaw<AffRow[]>`
        SELECT id, "affiliateCode", status, "agentCommissionRate"
        FROM "AffiliateProfile"
        WHERE id = ${extProfileId}
        LIMIT 1
      `;

      if (profiles.length > 0) {
        const p = profiles[0];
        type LinkRow = { id: number; code: string; url: string; clickCount: number; conversionCount: number };
        const links = await prisma.$queryRaw<LinkRow[]>`
          SELECT id, code, url, "clickCount", "conversionCount"
          FROM "AffiliateLink"
          WHERE "managerId" = ${extProfileId} AND status = 'ACTIVE'
          ORDER BY "createdAt" DESC
          LIMIT 5
        `;

        affiliateData = {
          profileId: p.id,
          affiliateCode: p.affiliateCode,
          status: p.status,
          agentCommissionRate: p.agentCommissionRate,
          links,
        };
      }
    }

    // 4. 계약 정보 (AffiliateContract - userId or name 매칭)
    type ContractRow = {
      id: number;
      status: string;
      name: string | null;
      phone: string | null;
      metadata: unknown;
      contractSignedAt: Date | null;
      createdAt: Date;
    };
    // phone 기준으로 매칭 (OrganizationMember.phone = AffiliateContract.phone)
    // phone으로만 계약 조회 (OR name 조건 제거 — 동명이인 계약 노출 방지)
    const contracts = member.phone
      ? await prisma.$queryRaw<ContractRow[]>`
          SELECT id, status, name, phone, metadata, "contractSignedAt", "createdAt"
          FROM "AffiliateContract"
          WHERE phone = ${member.phone}
          ORDER BY "createdAt" DESC
          LIMIT 5
        `
      : [];

    logger.info('[GET /api/admin/affiliate-managers/:memberId]', { memberId, role: ctx.role });

    return NextResponse.json({
      ok: true,
      data: {
        member: {
          id: member.id,
          userId: member.userId,
          organizationId: member.organizationId,
          phone: member.phone,
          email: member.email,
          displayName: member.displayName,
          role: member.role,
          isActive: member.isActive,
        },
        organization: member.organization
          ? {
              id: member.organization.id,
              name: member.organization.name,
              plan: member.organization.plan,
              status: member.organization.status,
              contractRef: member.organization.contractRef,
              createdAt: member.organization.createdAt.toISOString(),
            }
          : null,
        subMembers: subMembers.map((s) => ({
          id: s.id,
          userId: s.userId,
          phone: s.phone,
          displayName: s.displayName,
          role: s.role,
          isActive: s.isActive,
        })),
        affiliate: affiliateData,
        contracts: contracts.map((c) => {
          const meta = c.metadata as Record<string, unknown> | null;
          return {
            id: c.id,
            status: c.status,
            name: c.name,
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
    logger.error('[GET /api/admin/affiliate-managers/:memberId]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
