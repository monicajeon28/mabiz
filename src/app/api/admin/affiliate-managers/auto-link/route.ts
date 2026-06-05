export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/affiliate-managers/auto-link
 *
 * CRM에 연결되지 않은 BRANCH_MANAGER 어필리에이트를 전부 자동 연결.
 * 업그레이드 이전 계약자(김윤미·팽원준·장근영·boss1 등) 일괄 처리용.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  void req;
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const organizationId = ctx.organizationId ?? process.env.BONSA_ORG_ID ?? '';
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: '본사 조직 ID 없음 (BONSA_ORG_ID 환경변수 확인)' },
      { status: 500 },
    );
  }

  // 이미 연결된 userId 목록 (gm-{id} 형식)
  const linked = await prisma.organizationMember.findMany({
    where: { userId: { startsWith: 'gm-' } },
    select: { userId: true },
  });
  const linkedSet = new Set(linked.map((m) => m.userId));

  // BRANCH_MANAGER 전체 조회
  const profiles = await prisma.gmAffiliateProfile.findMany({
    where: { type: 'BRANCH_MANAGER', status: 'ACTIVE' },
    select: {
      id: true,
      userId: true,
      affiliateCode: true,
      displayName: true,
      contactPhone: true,
      contactEmail: true,
    },
  });

  const results: { name: string; affiliateCode: string; status: 'linked' | 'skipped' | 'error'; reason?: string }[] = [];

  for (const profile of profiles) {
    const gmUserId = `gm-${profile.userId}`;

    // 이미 연결됨
    if (linkedSet.has(gmUserId)) {
      results.push({ name: profile.displayName ?? '-', affiliateCode: profile.affiliateCode, status: 'skipped', reason: '이미 연결됨' });
      continue;
    }

    // GmUser 조회
    const gmUser = await prisma.gmUser.findUnique({ where: { id: profile.userId } });
    if (!gmUser) {
      results.push({ name: profile.displayName ?? '-', affiliateCode: profile.affiliateCode, status: 'error', reason: 'GmUser 없음' });
      continue;
    }

    try {
      await prisma.organizationMember.create({
        data: {
          organizationId,
          userId: gmUserId,
          role: 'OWNER',
          displayName: profile.displayName ?? gmUser.name ?? '대리점장',
          phone: profile.contactPhone ?? gmUser.phone ?? null,
          email: profile.contactEmail ?? gmUser.email ?? null,
          passwordHash: gmUser.password,
          isActive: true,
        },
      });
      results.push({ name: profile.displayName ?? '-', affiliateCode: profile.affiliateCode, status: 'linked' });
      logger.info('[auto-link] 연결 완료', { affiliateCode: profile.affiliateCode, gmUserId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: profile.displayName ?? '-', affiliateCode: profile.affiliateCode, status: 'error', reason: msg });
      logger.error('[auto-link] 연결 실패', { affiliateCode: profile.affiliateCode, err });
    }
  }

  const linked_count = results.filter((r) => r.status === 'linked').length;
  const skipped_count = results.filter((r) => r.status === 'skipped').length;
  const error_count = results.filter((r) => r.status === 'error').length;

  logger.info('[auto-link] 일괄 연결 완료', { linked_count, skipped_count, error_count });

  return NextResponse.json({
    ok: true,
    message: `연결 완료: ${linked_count}명 신규 연결, ${skipped_count}명 이미 연결됨${error_count > 0 ? `, ${error_count}명 오류` : ''}`,
    data: { linked_count, skipped_count, error_count, results },
  });
}
