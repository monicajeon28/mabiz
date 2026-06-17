export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/affiliate-managers/auto-link
 *
 * CRM에 연결되지 않은 BRANCH_MANAGER 어필리에이트를 전부 자동 연결.
 * 업그레이드 이전 계약자(김윤미·팽원준·장근영·boss1 등) 일괄 처리용.
 *
 * P0-2 수정: 각 BRANCH_MANAGER마다 독립 Organization 생성.
 * 동일 affiliateCode로 contractRef="aff-profile-{id}"를 키로 멱등 처리.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// ── slug 유틸 ──────────────────────────────────────────────────────────────
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base ?? 'org';
  let attempt = 0;
  while (attempt < 10) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${randomBytes(3).toString('hex')}`;
    attempt++;
  }
  return `${base}-${Date.now()}`;
}

/**
 * 대리점장 프로필에 대한 독립 Organization을 find-or-create합니다.
 * contractRef = "aff-profile-{profileId}" 를 멱등 키로 사용합니다.
 */
async function findOrCreateAgentOrg(profileId: number, displayName: string | null): Promise<string> {
  const contractRef = `aff-profile-${profileId}`;
  const existing = await prisma.organization.findFirst({ where: { contractRef } });
  if (existing) return existing.id;

  const baseName = displayName ?? `대리점-${profileId}`;
  // "대리점장" 접미사 제거 후 조직명 결정
  const orgName = baseName.endsWith(' 대리점장')
    ? baseName.replace(/ 대리점장$/, ' 대리점')
    : `${baseName} 대리점`;

  const slug = await uniqueSlug(slugify(orgName));
  const newOrg = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      status: 'ACTIVE',
      plan: 'BASIC',
      contractRef,
    },
  });
  logger.info('[auto-link] 대리점 전용 Organization 생성', {
    orgId: newOrg.id,
    slug,
    profileId,
  });
  return newOrg.id;
}

export async function POST(req: NextRequest) {
  void req;
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
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

  // N+1 방지: 미연결 프로필의 GmUser를 한 번에 배치 조회
  const unlinkProfiles = profiles.filter(p => !linkedSet.has(`gm-${p.userId}`));
  const gmUserIds = unlinkProfiles.map(p => p.userId);
  const gmUserList = gmUserIds.length > 0
    ? await prisma.gmUser.findMany({
        where: { id: { in: gmUserIds } },
        select: { id: true, name: true, phone: true, email: true, password: true },
      })
    : [];
  const gmUserMap = new Map(gmUserList.map(u => [u.id, u]));

  for (const profile of profiles) {
    const gmUserId = `gm-${profile.userId}`;

    // 이미 연결됨
    if (linkedSet.has(gmUserId)) {
      results.push({ name: profile.displayName ?? '-', affiliateCode: profile.affiliateCode, status: 'skipped', reason: '이미 연결됨' });
      continue;
    }

    // GmUser 맵에서 O(1) 조회 (루프 내 쿼리 제거)
    const gmUser = gmUserMap.get(profile.userId);
    if (!gmUser) {
      results.push({ name: profile.displayName ?? '-', affiliateCode: profile.affiliateCode, status: 'error', reason: 'GmUser 없음' });
      continue;
    }

    try {
      // P0-2: 각 BRANCH_MANAGER마다 독립 Organization 생성 (멱등)
      const agentOrgId = await findOrCreateAgentOrg(profile.id, profile.displayName);

      await prisma.organizationMember.create({
        data: {
          organizationId: agentOrgId,
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
      logger.info('[auto-link] 연결 완료', { affiliateCode: profile.affiliateCode, gmUserId, agentOrgId });
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
